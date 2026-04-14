// Persist / fetch analysis reports. Used by the upload hook and the
// GET /api/products/[id]/analysis route.

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { analyzeZip } from './analyzer'
import { scanVulnerabilities } from './cve'
import { analyzeOwnership } from './ownership-pipeline'
import { findFingerprintMatches, saveFingerprint, type FingerprintResult } from './fingerprint'
import { matchAgainstGithub, type GithubMatchResult, type GithubMatchHints } from './github-match'
import { recomputeSellerTier } from '@/lib/seller/tier'
import type { Report, IssueSeverity } from './types'
import type { VulnerabilityRow } from './cve'
import type { OwnershipResult } from './ownership'

/**
 * Run the analyzer on a ZIP already in Supabase Storage and upsert the result
 * into product_analyses. Safe to call in "fire-and-forget" mode from an upload
 * handler — it catches its own errors and writes a failed row instead.
 */
export async function runAnalysisForProduct(params: {
  productId: string
  bucket: string
  objectPath: string
}): Promise<void> {
  const { productId, bucket, objectPath } = params
  const admin = getSupabaseAdmin()

  try {
    const { data: blob, error: dlErr } = await admin.storage
      .from(bucket)
      .download(objectPath)

    if (dlErr || !blob) {
      throw new Error(`Download failed: ${dlErr?.message || 'no data'}`)
    }

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!isZipBuffer(buffer)) {
      await upsertFailure(productId, 'Product file is not a ZIP archive — analysis skipped.')
      return
    }

    const report: Report = await analyzeZip(buffer)

    await runCveScan(report)

    await admin
      .from('product_analyses')
      .upsert(
        {
          product_id: productId,
          quality_score: report.qualityScore,
          grade: report.grade,
          total_loc: report.metrics.totalLoc,
          total_files: report.metrics.totalFiles,
          dependency_count: report.dependencies.length,
          issue_count: report.issues.length,
          report,
          analyzer_version: report.analyzerVersion,
          status: 'completed',
          error_message: null,
        },
        { onConflict: 'product_id' }
      )

    // ─── Phase 4: Ownership & authenticity ─────────────────────────
    // Runs after the quality report is saved so a failure here never
    // blocks the main analysis from appearing to buyers.
    await runOwnershipPipeline(productId, buffer, report)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await upsertFailure(productId, message)
  }
}

// ─── Phase 3: OSV CVE scan on parsed dependencies ────────────────
// Free public API, no key required. Failures are non-fatal: the scan
// writes a `note` into the result and we continue with the rest of the
// report. Dev-only deps are skipped inside scanVulnerabilities().
async function runCveScan(report: Report): Promise<void> {
  try {
    const cveScan = await scanVulnerabilities(report.dependencies)
    report.cveScan = cveScan
    for (const v of cveScan.vulnerabilities.slice(0, 25)) {
      report.issues.push({
        severity: cveSeverityToIssue(v.severity),
        kind: 'security.vulnerable-dep',
        message: formatVulnMessage(v),
      })
    }
  } catch (cveErr) {
    const msg = cveErr instanceof Error ? cveErr.message : 'unknown error'
    report.cveScan = {
      scannedAt: new Date().toISOString(),
      scanned: 0,
      vulnerableDeps: 0,
      vulnerabilities: [],
      note: `CVE scan errored: ${msg}`,
    }
  }
}

function cveSeverityToIssue(sev: VulnerabilityRow['severity']): IssueSeverity {
  if (sev === 'critical') return 'critical'
  if (sev === 'high') return 'major'
  if (sev === 'medium') return 'minor'
  return 'info'
}

function formatVulnMessage(v: VulnerabilityRow): string {
  const versionPart = v.version ? `@${v.version}` : ''
  return `${v.packageName}${versionPart} — ${v.id}: ${v.summary}`
}

// ─── Phase 4: ownership + fingerprint + github match ──────────────

async function runOwnershipPipeline(
  productId: string,
  buffer: Buffer,
  report: Report,
): Promise<void> {
  try {
    const seller = await fetchSellerIdentity(productId)
    const { ownership, fingerprint, githubHints } = analyzeOwnership(buffer, seller)

    // Save our fingerprint so future uploads can match against it.
    await saveFingerprint(productId, fingerprint)

    // Compare our fingerprint against every other seller's fingerprints.
    const internalMatch = await findFingerprintMatches(fingerprint, productId)

    // Query GitHub for possible public-repo origins. Best-effort only.
    const githubMatch = await safeGithubMatch(report, fingerprint, githubHints)

    // Promote serious findings (internal overlap + github hits) into the
    // ownership signal list + adjust score/verdict accordingly.
    const adjusted = applyExternalSignals(ownership, internalMatch.matches.length, githubMatch.matches.length)

    await upsertOwnershipRow(productId, adjusted, {
      fingerprintMatches: internalMatch.matches.length,
      githubMatches: githubMatch.matches.length,
      fingerprintNote: internalMatch.note,
      githubNote: githubMatch.note,
      internalMatches: internalMatch.matches,
      githubMatchRows: githubMatch.matches,
    })

    // Fire-and-forget: fresh analysis + ownership data may move the seller
    // into a new tier. Never block on this.
    const sellerId = await fetchSellerId(productId)
    if (sellerId) await recomputeSellerTier(sellerId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    await upsertOwnershipFailure(productId, msg)
  }
}

async function fetchSellerId(productId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('products')
    .select('seller_id')
    .eq('id', productId)
    .maybeSingle()
  return (data as { seller_id?: string } | null)?.seller_id ?? null
}

async function fetchSellerIdentity(productId: string): Promise<{ displayName: string | null; email: string | null }> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('products')
    .select('seller:users!seller_id(display_name, email)')
    .eq('id', productId)
    .maybeSingle()

  const seller = (data as { seller?: { display_name?: string | null; email?: string | null } } | null)?.seller ?? null
  return {
    displayName: seller?.display_name ?? null,
    email: seller?.email ?? null,
  }
}

async function safeGithubMatch(
  report: Report,
  fingerprint: FingerprintResult,
  hints: GithubMatchHints,
): Promise<GithubMatchResult> {
  try {
    return await matchAgainstGithub(report.dependencies, fingerprint.contributingFiles, hints)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return { queriesRun: 0, matches: [], topConfidence: 0, note: `GitHub match errored: ${msg}` }
  }
}

function applyExternalSignals(
  ownership: OwnershipResult,
  internalMatches: number,
  githubMatches: number,
): OwnershipResult {
  const next: OwnershipResult = { ...ownership, signals: [...ownership.signals] }

  if (internalMatches > 0) {
    next.signals.push({
      kind: 'fingerprint.internal-overlap',
      strength: 'critical',
      description: `Another CodeVault seller has uploaded code that overlaps with this product's fingerprint (${internalMatches} match${internalMatches === 1 ? '' : 'es'}).`,
    })
    next.authenticityScore = Math.max(0, next.authenticityScore - 40)
  }

  if (githubMatches > 0) {
    next.signals.push({
      kind: 'github.public-repo-match',
      strength: 'warn',
      description: `This product's distinctive signals match ${githubMatches} public GitHub repo${githubMatches === 1 ? '' : 's'} — verify the seller owns or legally repackaged the upstream code.`,
    })
    next.authenticityScore = Math.max(0, next.authenticityScore - 15)
  }

  next.verdict = recomputeVerdict(next.authenticityScore, next.signals)
  return next
}

function recomputeVerdict(score: number, signals: OwnershipResult['signals']): OwnershipResult['verdict'] {
  const hasCritical = signals.some((s) => s.strength === 'critical')
  if (hasCritical) return 'stolen'
  if (score >= 85) return 'verified'
  if (score >= 65) return 'ok'
  if (score >= 40) return 'suspicious'
  return 'stolen'
}

interface OwnershipUpsertMeta {
  fingerprintMatches: number
  githubMatches: number
  fingerprintNote?: string
  githubNote?: string
  internalMatches: unknown
  githubMatchRows: unknown
}

async function upsertOwnershipRow(
  productId: string,
  ownership: OwnershipResult,
  meta: OwnershipUpsertMeta,
): Promise<void> {
  const admin = getSupabaseAdmin()
  await admin
    .from('product_ownership_checks')
    .upsert(
      {
        product_id: productId,
        verdict: ownership.verdict,
        authenticity_score: ownership.authenticityScore,
        license_name: ownership.license.found ? ownership.license.name : null,
        license_classification: ownership.license.classification,
        license_allows_resale: ownership.license.allowsResale,
        git_present: ownership.git.hasGitFolder,
        git_unique_authors: ownership.git.uniqueAuthors.length,
        git_matches_seller: ownership.signals.some((s) => s.kind === 'git.seller-authored'),
        copyright_holders_count: ownership.headers.distinctHolders.length,
        obfuscated_file_count: ownership.obfuscation.obfuscatedFiles,
        fingerprint_matches: meta.fingerprintMatches,
        github_match_count: meta.githubMatches,
        signals: ownership.signals,
        details: {
          git: ownership.git,
          license: ownership.license,
          headers: ownership.headers,
          obfuscation: ownership.obfuscation,
          internalMatches: meta.internalMatches,
          githubMatches: meta.githubMatchRows,
          fingerprintNote: meta.fingerprintNote,
          githubNote: meta.githubNote,
        },
      },
      { onConflict: 'product_id' },
    )
}

async function upsertOwnershipFailure(productId: string, message: string): Promise<void> {
  const admin = getSupabaseAdmin()
  await admin
    .from('product_ownership_checks')
    .upsert(
      {
        product_id: productId,
        verdict: 'unknown',
        authenticity_score: 0,
        signals: [],
        details: { error: message.slice(0, 500) },
      },
      { onConflict: 'product_id' },
    )
}

async function upsertFailure(productId: string, message: string) {
  const admin = getSupabaseAdmin()
  await admin
    .from('product_analyses')
    .upsert(
      {
        product_id: productId,
        quality_score: 0,
        grade: 'F',
        total_loc: 0,
        total_files: 0,
        dependency_count: 0,
        issue_count: 0,
        report: {},
        status: 'failed',
        error_message: message.slice(0, 1000),
      },
      { onConflict: 'product_id' }
    )
}

// ZIP magic number check: PK\x03\x04
function isZipBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
}

/**
 * Extract bucket + object path from a Supabase Storage public URL.
 * Returns null if the URL doesn't match the expected shape.
 *
 *   https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path...>
 */
export function parseStorageUrl(url: string): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(url)
    const match = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/)
    if (!match) return null
    return { bucket: match[1], objectPath: decodeURIComponent(match[2]) }
  } catch {
    return null
  }
}
