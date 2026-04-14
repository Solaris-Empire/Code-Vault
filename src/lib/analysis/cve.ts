// Dependency CVE scanner using Google's OSV.dev public API.
//
// OSV.dev is FREE — no API key, no paid tier, no rate limit concerns for
// modest batch sizes. We use /v1/querybatch which accepts up to 1000 queries
// per call. We chunk to 200, with a short timeout, so a slow upstream
// doesn't stall the analysis pipeline.
//
// Ref: https://google.github.io/osv.dev/post-v1-querybatch/

import type { DependencyInfo } from './types'

export interface VulnerabilityRow {
  /** OSV ID (e.g. "GHSA-...", "CVE-...") */
  id: string
  packageName: string
  ecosystem: string
  version: string | null
  summary: string
  /** highest severity score we could find (CVSS vector or qualitative) */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  publishedAt: string | null
  url: string
}

export interface CveScanResult {
  scannedAt: string
  /** Number of dependencies we attempted to scan (post-ecosystem-mapping). */
  scanned: number
  /** Number that returned at least one vulnerability. */
  vulnerableDeps: number
  /** All vulnerability rows, de-duped across deps. */
  vulnerabilities: VulnerabilityRow[]
  /** Informational note if the scan was partial or failed. */
  note?: string
}

// Map our manifest filenames to OSV ecosystems.
function manifestToEcosystem(manifest: string): string | null {
  const name = manifest.split('/').pop() || manifest
  if (name === 'package.json') return 'npm'
  if (name === 'composer.json') return 'Packagist'
  if (name === 'requirements.txt') return 'PyPI'
  if (name === 'Gemfile') return 'RubyGems'
  return null
}

// Strip range operators/spaces to get a single concrete version for OSV.
// OSV's query matches a single exact version — approximate prefixes with the
// floor version (e.g. "^1.2.3" → "1.2.3", ">=2.0" → "2.0", "~> 3.1" → "3.1").
function normalizeVersion(raw: string | undefined): string | null {
  if (!raw) return null
  let v = raw.trim()
  v = v.replace(/^(\^|~|>=|<=|>|<|~>|=)\s*/, '').trim()
  // Keep only the first token if there are compound constraints ("^1.0.0 || ^2.0.0")
  v = v.split(/\s+/)[0].replace(/[,|].*$/, '')
  // Strip a leading "v"
  v = v.replace(/^v/i, '')
  if (!v || v === '*' || v === 'latest') return null
  return v
}

interface OsvQuery {
  version?: string
  package: { name: string; ecosystem: string }
}

interface OsvBatchResponse {
  results?: Array<{ vulns?: Array<{ id: string; modified?: string }> }>
}

interface OsvVulnDetail {
  id: string
  summary?: string
  details?: string
  published?: string
  references?: Array<{ url: string }>
  database_specific?: { severity?: string; cwe_ids?: string[] }
  severity?: Array<{ type: string; score: string }>
  affected?: Array<{ package?: { ecosystem?: string; name?: string } }>
}

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch'
const OSV_VULN_URL = 'https://api.osv.dev/v1/vulns/'
const BATCH_SIZE = 200
const FETCH_TIMEOUT_MS = 8000
const MAX_VULN_DETAIL_FETCHES = 50 // cap individual lookups

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function cvssScoreToSeverity(score: string): VulnerabilityRow['severity'] {
  // CVSS v3 vector starts with "CVSS:3" — extract the base score if present,
  // otherwise accept a plain number.
  const m = /(\d+\.\d+)/.exec(score)
  if (!m) return 'unknown'
  const n = parseFloat(m[1])
  if (n >= 9) return 'critical'
  if (n >= 7) return 'high'
  if (n >= 4) return 'medium'
  if (n > 0) return 'low'
  return 'unknown'
}

function pickSeverity(vuln: OsvVulnDetail): VulnerabilityRow['severity'] {
  if (vuln.severity && vuln.severity.length > 0) {
    // Prefer CVSS_V3 if present, then CVSS_V2, then any
    const v3 = vuln.severity.find((s) => s.type === 'CVSS_V3')
    const chosen = v3 || vuln.severity[0]
    return cvssScoreToSeverity(chosen.score)
  }
  const qual = vuln.database_specific?.severity?.toLowerCase()
  if (qual === 'critical' || qual === 'high' || qual === 'medium' || qual === 'low') return qual
  return 'unknown'
}

function buildQueries(deps: DependencyInfo[]): Array<{ dep: DependencyInfo; query: OsvQuery }> {
  const out: Array<{ dep: DependencyInfo; query: OsvQuery }> = []
  for (const d of deps) {
    if (d.dev) continue // skip dev deps — buyers don't ship them
    const eco = manifestToEcosystem(d.manifest)
    if (!eco) continue
    const version = normalizeVersion(d.version)
    const query: OsvQuery = { package: { name: d.name, ecosystem: eco } }
    if (version) query.version = version
    out.push({ dep: d, query })
  }
  return out
}

export async function scanVulnerabilities(deps: DependencyInfo[]): Promise<CveScanResult> {
  const queries = buildQueries(deps)
  const result: CveScanResult = {
    scannedAt: new Date().toISOString(),
    scanned: queries.length,
    vulnerableDeps: 0,
    vulnerabilities: [],
  }
  if (queries.length === 0) return result

  // ─── 1. Batch-query OSV for vulnerability IDs per dep ───────────
  const hitsByDep: Array<{ dep: DependencyInfo; vulnIds: string[] }> = []
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const chunk = queries.slice(i, i + BATCH_SIZE)
    let batchJson: OsvBatchResponse | null = null
    try {
      const res = await fetchWithTimeout(
        OSV_BATCH_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: chunk.map((q) => q.query) }),
        },
        FETCH_TIMEOUT_MS,
      )
      if (!res.ok) {
        result.note = `OSV responded ${res.status} — partial scan.`
        continue
      }
      batchJson = (await res.json()) as OsvBatchResponse
    } catch {
      result.note = 'OSV batch query timed out — partial scan.'
      continue
    }

    const results = batchJson?.results || []
    for (let j = 0; j < chunk.length; j++) {
      const dep = chunk[j].dep
      const vulns = results[j]?.vulns || []
      if (vulns.length === 0) continue
      hitsByDep.push({ dep, vulnIds: vulns.map((v) => v.id) })
    }
  }

  result.vulnerableDeps = hitsByDep.length
  if (hitsByDep.length === 0) return result

  // ─── 2. Fetch per-vuln detail (capped) ─────────────────────────
  const allIds = new Set<string>()
  for (const h of hitsByDep) for (const id of h.vulnIds) allIds.add(id)
  const idList = Array.from(allIds).slice(0, MAX_VULN_DETAIL_FETCHES)
  const detailById = new Map<string, OsvVulnDetail>()

  const detailPromises = idList.map(async (id) => {
    try {
      const res = await fetchWithTimeout(OSV_VULN_URL + encodeURIComponent(id), {}, FETCH_TIMEOUT_MS)
      if (!res.ok) return
      const detail = (await res.json()) as OsvVulnDetail
      detailById.set(id, detail)
    } catch {
      // ignore — just skip this one
    }
  })
  await Promise.all(detailPromises)

  // ─── 3. Build VulnerabilityRow per (dep, vulnId) ───────────────
  const rows: VulnerabilityRow[] = []
  for (const hit of hitsByDep) {
    for (const vulnId of hit.vulnIds) {
      const detail = detailById.get(vulnId)
      const summary =
        detail?.summary ||
        (detail?.details ? detail.details.slice(0, 200) : `Vulnerability ${vulnId}`)
      const eco = manifestToEcosystem(hit.dep.manifest) || 'unknown'
      rows.push({
        id: vulnId,
        packageName: hit.dep.name,
        ecosystem: eco,
        version: normalizeVersion(hit.dep.version),
        summary,
        severity: detail ? pickSeverity(detail) : 'unknown',
        publishedAt: detail?.published || null,
        url: `https://osv.dev/vulnerability/${vulnId}`,
      })
    }
  }

  // Sort: critical → high → medium → low → unknown, then by package name
  const sevRank: Record<VulnerabilityRow['severity'], number> = {
    critical: 0, high: 1, medium: 2, low: 3, unknown: 4,
  }
  rows.sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity]
    return a.packageName.localeCompare(b.packageName)
  })
  result.vulnerabilities = rows
  return result
}
