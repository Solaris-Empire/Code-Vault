// Project fingerprint — used for internal duplicate detection across
// sellers. We build two things per upload:
//
//   1. A coarse "structure hash" — sorted list of relative file paths.
//      Two uploads with identical file trees are almost certainly the
//      same project.
//
//   2. A list of per-file SHA-256 content hashes (top 40 largest source
//      files). If another seller's fingerprint shares 15+ of the same
//      file hashes, they've uploaded overlapping code.
//
// Stored in the `public.product_fingerprints` table (Phase 4 migration).
// All hashing runs locally — no external calls from this module.

import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const MAX_TOP_FILE_HASHES = 40
const MIN_HASH_FILE_BYTES = 200           // skip trivially small files
const MAX_HASH_FILE_BYTES = 1_000_000     // skip huge files (noise)

// A file contributes to the fingerprint only if it looks like source.
const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.php', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.m', '.mm',
  '.html', '.css', '.scss', '.vue', '.svelte',
  '.sql', '.sh', '.bash', '.ps1',
])

export interface ContributingFile {
  relPath: string
  size: number
  sha256: string
}

export interface FingerprintResult {
  structureHash: string
  fileHashes: string[]
  contributingFiles: ContributingFile[]
  totalSourceFiles: number
}

export class FingerprintCollector {
  private readonly pathsForStructure: string[] = []
  private readonly candidates: ContributingFile[] = []
  private totalSource = 0

  /** Feed a file entry (already pulled from the ZIP). Called from the
   *  analyzer while it walks entries — stays synchronous. */
  scanFile(relPath: string, buf: Buffer): void {
    // Structure list: every non-generated source file path
    if (!hasSourceExt(relPath)) return
    this.totalSource++
    this.pathsForStructure.push(relPath)

    if (buf.length < MIN_HASH_FILE_BYTES || buf.length > MAX_HASH_FILE_BYTES) return
    const sha = createHash('sha256').update(buf).digest('hex')
    this.candidates.push({ relPath, size: buf.length, sha256: sha })
  }

  finalize(): FingerprintResult {
    // Structure hash: sort paths, join, sha256. Stable across archive layouts.
    const structureInput = this.pathsForStructure.slice().sort().join('\n')
    const structureHash = createHash('sha256').update(structureInput).digest('hex')

    // Top-N largest source files for the file-hash list
    this.candidates.sort((a, b) => b.size - a.size)
    const top = this.candidates.slice(0, MAX_TOP_FILE_HASHES)

    return {
      structureHash,
      fileHashes: top.map((c) => c.sha256),
      contributingFiles: top,
      totalSourceFiles: this.totalSource,
    }
  }
}

function hasSourceExt(relPath: string): boolean {
  const base = relPath.split('/').pop() || relPath
  const dot = base.lastIndexOf('.')
  if (dot < 0) return false
  return SOURCE_EXTS.has(base.slice(dot).toLowerCase())
}

// ─── Collision lookup ──────────────────────────────────────────────

export interface FingerprintMatch {
  productId: string
  matchedFileHashes: number
  structureMatch: boolean
}

export interface FingerprintMatchResult {
  matches: FingerprintMatch[]
  note?: string
}

/**
 * Check if a just-computed fingerprint overlaps with any previously stored
 * fingerprint from a DIFFERENT product. Returns up to 5 matches, ordered by
 * number of shared file hashes descending.
 */
export async function findFingerprintMatches(
  fingerprint: FingerprintResult,
  ownProductId: string,
): Promise<FingerprintMatchResult> {
  if (fingerprint.fileHashes.length === 0) {
    return { matches: [], note: 'No hashable source files — fingerprint match skipped.' }
  }

  const admin = getSupabaseAdmin()

  // Find rows whose structure hash matches OR whose file_hashes share at
  // least one entry with ours. Both are cheap thanks to the GIN indexes
  // we add in the migration.
  const { data, error } = await admin
    .from('product_fingerprints')
    .select('product_id, structure_hash, file_hashes')
    .neq('product_id', ownProductId)
    .or(`structure_hash.eq.${fingerprint.structureHash},file_hashes.ov.{${fingerprint.fileHashes.join(',')}}`)
    .limit(50)

  if (error) {
    return { matches: [], note: `Fingerprint lookup errored: ${error.message}` }
  }

  const ourSet = new Set(fingerprint.fileHashes)
  const matches: FingerprintMatch[] = []
  for (const row of data || []) {
    const theirs = (row.file_hashes as string[] | null) || []
    let overlap = 0
    for (const h of theirs) if (ourSet.has(h)) overlap++
    const structureMatch = row.structure_hash === fingerprint.structureHash
    if (overlap === 0 && !structureMatch) continue
    matches.push({
      productId: row.product_id as string,
      matchedFileHashes: overlap,
      structureMatch,
    })
  }

  matches.sort((a, b) => b.matchedFileHashes - a.matchedFileHashes)
  return { matches: matches.slice(0, 5) }
}

/** Persist the fingerprint so future uploads can compare against it. */
export async function saveFingerprint(
  productId: string,
  fingerprint: FingerprintResult,
): Promise<void> {
  const admin = getSupabaseAdmin()
  await admin
    .from('product_fingerprints')
    .upsert(
      {
        product_id: productId,
        structure_hash: fingerprint.structureHash,
        file_hashes: fingerprint.fileHashes,
        total_source_files: fingerprint.totalSourceFiles,
      },
      { onConflict: 'product_id' },
    )
}
