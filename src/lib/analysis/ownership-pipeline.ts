// Orchestrates Phase 4 ownership + fingerprint extraction in a single
// ZIP walk. Kept separate from `analyzer.ts` so that the quality-report
// pipeline (Phases 1-3) stays untouched.
//
// Called from `store.ts` right after `analyzeZip()` succeeds.

import AdmZip from 'adm-zip'
import type { IZipEntry } from 'adm-zip'
import { shouldIgnorePath } from './languages'
import { OwnershipCollector, isGitPath, isLicenseFile, type OwnershipResult } from './ownership'
import { FingerprintCollector, type FingerprintResult } from './fingerprint'
import type { GithubMatchHints } from './github-match'

// Keep file reads bounded per entry — same caps as the main analyzer.
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024

export interface OwnershipSellerInfo {
  displayName: string | null
  email: string | null
}

export interface OwnershipPipelineResult {
  ownership: OwnershipResult
  fingerprint: FingerprintResult
  githubHints: GithubMatchHints
}

interface WalkContext {
  owner: OwnershipCollector
  fp: FingerprintCollector
  readmeTitle: string | null
  folderCounts: Map<string, number>
}

export function analyzeOwnership(
  zipBuffer: Buffer,
  seller: OwnershipSellerInfo,
): OwnershipPipelineResult {
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()
  const ctx: WalkContext = {
    owner: new OwnershipCollector(),
    fp: new FingerprintCollector(),
    readmeTitle: null,
    folderCounts: new Map<string, number>(),
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue
    processEntry(entry, ctx)
  }

  return {
    ownership: ctx.owner.finalize(seller.displayName, seller.email),
    fingerprint: ctx.fp.finalize(),
    githubHints: {
      readmeTitle: ctx.readmeTitle,
      distinctiveFolderPath: pickDistinctiveFolder(ctx.folderCounts),
    },
  }
}

function processEntry(entry: IZipEntry, ctx: WalkContext): void {
  const relPath = entry.entryName.replaceAll('\\', '/')

  // .git/** entries feed ONLY the ownership collector — never count
  // toward fingerprints or source analysis.
  if (isGitPath(relPath)) {
    ctx.owner.scanGitEntry(entry, relPath)
    return
  }

  if (shouldIgnorePath(relPath)) return

  if (isLicenseFile(relPath)) {
    const text = safeReadText(entry)
    if (text !== null) ctx.owner.scanLicenseFile(relPath, text)
    return
  }

  if (entry.header.size > MAX_TEXT_FILE_BYTES) return
  const buf = safeReadBuffer(entry)
  if (!buf) return

  ctx.fp.scanFile(relPath, buf)
  const text = buf.toString('utf8')
  ctx.owner.scanSourceFile(relPath, text)

  collectHints(relPath, text, ctx)
}

function collectHints(relPath: string, text: string, ctx: WalkContext): void {
  // First-level README title extraction. Only the earliest `# X` wins.
  if (!ctx.readmeTitle && /^README(\.[a-z]+)?$/i.test(relPath.split('/').pop() || '')) {
    ctx.readmeTitle = extractMarkdownH1(text)
  }

  const folder = deepFolder(relPath)
  if (folder) ctx.folderCounts.set(folder, (ctx.folderCounts.get(folder) ?? 0) + 1)
}

function extractMarkdownH1(md: string): string | null {
  const lines = md.split(/\r?\n/)
  for (const raw of lines.slice(0, 40)) {
    const line = raw.trim()
    if (line.startsWith('# ') && line.length < 80) {
      return line.slice(2).trim().replaceAll(/[`*_]/g, '')
    }
  }
  return null
}

function deepFolder(relPath: string): string | null {
  const parts = relPath.split('/')
  // Must be at least 3 levels deep, last segment is a file → use the parent folder chain.
  if (parts.length < 3) return null
  const chain = parts.slice(0, -1).join('/')
  // Reject obviously generic chains.
  const lower = chain.toLowerCase()
  if (lower.startsWith('node_modules') || lower.startsWith('vendor/') || lower.startsWith('.next')) return null
  return chain
}

function pickDistinctiveFolder(counts: Map<string, number>): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const [path, count] of counts) {
    // Prefer longer, less common folder chains with enough files to matter.
    if (count < 2 || count > 40) continue
    const score = path.length + count
    if (score > bestScore) {
      bestScore = score
      best = path
    }
  }
  return best
}

function safeReadBuffer(entry: IZipEntry): Buffer | null {
  try {
    return entry.getData()
  } catch {
    return null
  }
}

function safeReadText(entry: IZipEntry): string | null {
  const buf = safeReadBuffer(entry)
  if (!buf) return null
  try {
    return buf.toString('utf8')
  } catch {
    return null
  }
}
