// Cyclomatic complexity scanner — pure regex, no AST.
//
// For each "function-like" block we find, count decision points (branches)
// inside it: if / else if / for / while / case / catch / && / || / ?: / .
// Start at 1, each branch adds 1 — the classical McCabe definition.
//
// This is a heuristic, NOT a perfect parser. It won't handle every language
// or every edge case. But for mainstream JS/TS/PHP/Python/Go/Java it gives
// an honest signal that matches human intuition about "how gnarly is this
// function". We clearly label it as a heuristic in the UI.

export interface FunctionComplexity {
  file: string
  line: number
  name: string
  complexity: number
  loc: number
}

export interface ComplexityResult {
  /** Total function-like blocks analyzed. */
  totalFunctions: number
  /** Average complexity across all functions. */
  avgComplexity: number
  /** Highest complexity seen. */
  maxComplexity: number
  /** Functions with cyclomatic complexity ≥ 11 (SonarQube "complex"). */
  complexFunctionCount: number
  /** Top offenders, sorted by complexity desc. */
  topOffenders: FunctionComplexity[]
}

// Decision-point tokens. Weighted by 1 each (McCabe). `&&` and `||` add
// branches; `?:` (ternary) adds one; case adds one per label; catch adds one.
const BRANCH_PATTERNS: RegExp[] = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,   // else-if counted separately but still +1
  /\bfor\s*\(/g,
  /\bforeach\s*\(/gi,
  /\bwhile\s*\(/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /&&/g,
  /\|\|/g,
  /\?[^?:]/g, // best-effort ternary (avoid null-coalesce ??)
]

// Languages we know how to look for function/method starts in.
// JS/TS/PHP/Java/C#/Go/Rust/Swift/Kotlin all use braces `{ ... }`.
// Python uses indentation — handled separately.
const BRACE_LANGS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.php', '.go', '.rs',
  '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.cs',
])
const PY_LANG = new Set(['.py'])

// Function declaration patterns for brace-based languages.
// We capture a "name" where possible, otherwise fall back to "<anonymous>".
const FN_PATTERNS: Array<{ re: RegExp; nameIdx: number }> = [
  // function foo( ... ) {
  { re: /\bfunction\s+(\w+)\s*\([^)]*\)\s*\{/g, nameIdx: 1 },
  // const foo = ( ... ) => {
  { re: /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/g, nameIdx: 1 },
  // name( ... ) { (method shorthand / PHP/Java/C# methods)
  { re: /(?:^|\s)(?:public|private|protected|static|async|export|final|override)?\s*(\w+)\s*\([^)]*\)\s*\{/gm, nameIdx: 1 },
  // func Name(...) { (Go)
  { re: /\bfunc\s+(?:\([^)]+\)\s+)?(\w+)\s*\([^)]*\)[^\{]*\{/g, nameIdx: 1 },
  // fn name(...) { (Rust)
  { re: /\bfn\s+(\w+)\s*\([^)]*\)[^\{]*\{/g, nameIdx: 1 },
  // def fnName(...) (PHP method without visibility? already covered; Python handled separately)
]

interface FnCandidate {
  name: string
  startIdx: number
  line: number
}

// Given the content of a brace-language file, find each function body as a
// [startIdx, endIdx] slice by matching braces from the opening `{`.
function extractBraceFunctions(content: string): Array<{ name: string; line: number; body: string }> {
  const found: Array<{ name: string; line: number; body: string }> = []
  const seenStarts = new Set<number>()
  const candidates: FnCandidate[] = []

  for (const { re, nameIdx } of FN_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content))) {
      // find the `{` — it's at or after the match end
      const openIdx = content.indexOf('{', m.index + m[0].length - 1)
      if (openIdx < 0) continue
      if (seenStarts.has(openIdx)) continue
      seenStarts.add(openIdx)
      const name = m[nameIdx] || '<anonymous>'
      const line = content.slice(0, m.index).split(/\r?\n/).length
      candidates.push({ name, startIdx: openIdx, line })
      if (m.index === re.lastIndex) re.lastIndex++ // safety
    }
  }

  for (const c of candidates) {
    const end = findMatchingBrace(content, c.startIdx)
    if (end < 0) continue
    const body = content.slice(c.startIdx, end + 1)
    // skip trivial bodies (< 2 LOC)
    if (body.split(/\r?\n/).length < 2) continue
    found.push({ name: c.name, line: c.line, body })
  }

  return found
}

// Find the index of the `}` matching the `{` at openIdx, honoring strings/comments.
function findMatchingBrace(content: string, openIdx: number): number {
  let depth = 0
  let inString: string | null = null
  let inLineComment = false
  let inBlockComment = false
  for (let i = openIdx; i < content.length; i++) {
    const c = content[i]
    const next = content[i + 1]

    if (inLineComment) {
      if (c === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i++ }
      continue
    }
    if (inString) {
      if (c === '\\') { i++; continue }
      if (c === inString) inString = null
      continue
    }

    if (c === '/' && next === '/') { inLineComment = true; i++; continue }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue }

    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function countBranches(body: string): number {
  let count = 1 // base complexity
  for (const re of BRANCH_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(body))) {
      count++
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  return count
}

// Python functions by indentation — find `def foo(...):` then walk forward
// until indentation drops back to the def's level.
function extractPythonFunctions(content: string): Array<{ name: string; line: number; body: string }> {
  const found: Array<{ name: string; line: number; body: string }> = []
  const lines = content.split(/\r?\n/)
  const defRe = /^(\s*)def\s+(\w+)\s*\(/

  for (let i = 0; i < lines.length; i++) {
    const m = defRe.exec(lines[i])
    if (!m) continue
    const baseIndent = m[1].length
    const name = m[2]
    const bodyLines = [lines[i]]
    let j = i + 1
    for (; j < lines.length; j++) {
      const l = lines[j]
      if (l.trim() === '') { bodyLines.push(l); continue }
      const indentMatch = /^(\s*)/.exec(l)
      const indent = indentMatch ? indentMatch[1].length : 0
      if (indent <= baseIndent) break
      bodyLines.push(l)
    }
    if (bodyLines.length < 2) continue
    found.push({ name, line: i + 1, body: bodyLines.join('\n') })
  }

  return found
}

export class ComplexityScanner {
  private functions: FunctionComplexity[] = []

  scanFile(content: string, relPath: string, ext: string): void {
    let fns: Array<{ name: string; line: number; body: string }> = []
    if (BRACE_LANGS.has(ext)) fns = extractBraceFunctions(content)
    else if (PY_LANG.has(ext)) fns = extractPythonFunctions(content)
    else return

    for (const fn of fns) {
      const loc = fn.body.split(/\r?\n/).length
      const complexity = countBranches(fn.body)
      this.functions.push({
        file: relPath,
        line: fn.line,
        name: fn.name,
        complexity,
        loc,
      })
    }
  }

  finalize(): ComplexityResult {
    const total = this.functions.length
    if (total === 0) {
      return {
        totalFunctions: 0,
        avgComplexity: 0,
        maxComplexity: 0,
        complexFunctionCount: 0,
        topOffenders: [],
      }
    }
    let sum = 0
    let max = 0
    let complex = 0
    for (const fn of this.functions) {
      sum += fn.complexity
      if (fn.complexity > max) max = fn.complexity
      if (fn.complexity >= 11) complex++
    }
    const topOffenders = this.functions
      .slice()
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 15)

    return {
      totalFunctions: total,
      avgComplexity: Math.round((sum / total) * 10) / 10,
      maxComplexity: max,
      complexFunctionCount: complex,
      topOffenders,
    }
  }
}
