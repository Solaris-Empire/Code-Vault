// Code duplication detector — pure Node, no external binaries.
//
// Strategy (jscpd-lite): normalize each source line (strip whitespace,
// trailing comments, quoted-string contents), slide a window of N lines
// across every file, hash each window, and group identical hashes across
// files. Any hash seen in 2+ places is a duplicated block.
//
// This is NOT AST-perfect, but it catches the vast majority of real-world
// copy-paste: repeated CRUD blocks, duplicated components, lifted utility
// functions, etc. Runs in milliseconds on a typical product archive.

const WINDOW_LINES = 6        // lines per duplication window (smaller = more sensitive)
const MIN_LINE_CHARS = 12     // ignore windows whose lines are too short/trivial

export interface DuplicateBlock {
  /** Number of duplicated lines in this block. */
  lines: number
  /** Locations where this block appears. */
  occurrences: Array<{ file: string; line: number }>
  /** Representative snippet (first occurrence, first 160 chars). */
  snippet: string
}

export interface DuplicationResult {
  /** Total source lines scanned (non-blank non-comment-only). */
  linesScanned: number
  /** Total lines that appear as part of any duplicate block (counted once per occurrence). */
  duplicatedLines: number
  /** duplicatedLines / linesScanned (0..1). */
  ratio: number
  /** Top duplicate blocks by size, sorted desc. */
  topBlocks: DuplicateBlock[]
}

// Fast non-crypto string hash (djb2-ish) — good enough for grouping lines.
function fastHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// Normalize a line so cosmetic differences don't hide real duplicates.
// - Trim
// - Collapse internal whitespace
// - Strip // and # trailing comments (simple, not perfect for strings)
// - Replace string literals with a placeholder so copy-pasted blocks with
//   different string values still match (e.g. labels, messages)
function normalizeLine(raw: string): string {
  let s = raw.trim()
  if (!s) return ''
  // strip trailing // comment
  const slashIdx = s.indexOf('//')
  if (slashIdx >= 0) s = s.slice(0, slashIdx).trim()
  // strip trailing # comment (Python/Ruby/Shell)
  const hashIdx = s.indexOf('#')
  if (hashIdx >= 0 && !s.includes('#{')) s = s.slice(0, hashIdx).trim()
  if (!s) return ''
  // replace string literals with a token
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, '"S"')
  s = s.replace(/'(?:[^'\\]|\\.)*'/g, "'S'")
  s = s.replace(/`(?:[^`\\]|\\.)*`/g, '`S`')
  // collapse whitespace
  s = s.replace(/\s+/g, ' ')
  return s
}

export class DuplicationDetector {
  // hash → occurrences (file + starting line)
  private windows = new Map<string, Array<{ file: string; line: number; sample: string }>>()
  private linesScanned = 0

  scanFile(content: string, relPath: string): void {
    const rawLines = content.split(/\r?\n/)
    // Pre-normalize each line, carry over its original 1-based index
    const norm: Array<{ idx: number; text: string }> = []
    for (let i = 0; i < rawLines.length; i++) {
      const n = normalizeLine(rawLines[i])
      if (n.length >= MIN_LINE_CHARS) norm.push({ idx: i + 1, text: n })
    }
    this.linesScanned += norm.length
    if (norm.length < WINDOW_LINES) return

    // Slide window of WINDOW_LINES across the normalized stream
    for (let i = 0; i + WINDOW_LINES <= norm.length; i++) {
      const slice = norm.slice(i, i + WINDOW_LINES)
      const joined = slice.map((s) => s.text).join('\n')
      const h = fastHash(joined)
      const startLine = slice[0].idx
      const sample = slice[0].text.slice(0, 160)
      const list = this.windows.get(h)
      if (list) {
        list.push({ file: relPath, line: startLine, sample })
      } else {
        this.windows.set(h, [{ file: relPath, line: startLine, sample }])
      }
    }
  }

  finalize(): DuplicationResult {
    // A "duplicate" is any window hash with ≥ 2 occurrences.
    // Count duplicated lines (sum over duplicate occurrences × WINDOW_LINES),
    // with de-dup per file so overlapping windows don't over-count.
    const blocks: DuplicateBlock[] = []
    // Track per-file which line-ranges have already been counted as duplicated
    const coveredLinesPerFile = new Map<string, Set<number>>()

    for (const list of this.windows.values()) {
      if (list.length < 2) continue

      const occurrences = list.map((o) => ({ file: o.file, line: o.line }))
      const snippet = list[0].sample

      for (const occ of list) {
        let set = coveredLinesPerFile.get(occ.file)
        if (!set) {
          set = new Set<number>()
          coveredLinesPerFile.set(occ.file, set)
        }
        for (let k = 0; k < WINDOW_LINES; k++) set.add(occ.line + k)
      }

      blocks.push({
        lines: WINDOW_LINES,
        occurrences,
        snippet,
      })
    }

    let duplicatedLines = 0
    for (const set of coveredLinesPerFile.values()) duplicatedLines += set.size

    // Keep the top blocks for reporting — prioritize blocks that appear many times
    const topBlocks = blocks
      .sort((a, b) => b.occurrences.length - a.occurrences.length)
      .slice(0, 25)

    const ratio = this.linesScanned > 0 ? duplicatedLines / this.linesScanned : 0

    return {
      linesScanned: this.linesScanned,
      duplicatedLines,
      ratio: Math.round(ratio * 10000) / 10000,
      topBlocks,
    }
  }
}
