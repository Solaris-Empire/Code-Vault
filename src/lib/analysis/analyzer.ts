// Pure-Node code analyzer. Given a ZIP buffer, walks every text file,
// computes LOC/comment/blank metrics, language breakdown, dependency list,
// and security red flags. Produces a deterministic Report.

import AdmZip from 'adm-zip'
import type { IZipEntry } from 'adm-zip'
import { getLanguageByExt, shouldIgnorePath, isGeneratedFile, type LanguageDef } from './languages'
import { AiDetector } from './ai-detector'
import { DuplicationDetector } from './duplication'
import { ComplexityScanner } from './complexity'
import { TestScanner } from './tests'
import type {
  Report,
  Issue,
  LanguageBreakdown,
  DependencyInfo,
  Metrics,
} from './types'

const ANALYZER_VERSION = '1.0.0'

// Files above this size we skip for line-by-line parsing (still count as binary)
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024 // 2 MB
// Total bytes we'll read out of the archive before bailing (safety cap)
const MAX_TOTAL_BYTES = 150 * 1024 * 1024 // 150 MB
// A file with more lines than this is flagged as a "god file"
const GOD_FILE_LOC = 500
// How many bytes of a single file we scan for red flags (cost bound)
const RED_FLAG_SAMPLE_BYTES = 200_000

// Security red-flag patterns — each match becomes an issue.
// Phase 3 expanded: SQL injection, weak crypto, insecure random, disabled TLS,
// unsafe deserialization, open CORS, exposed env leaks, dangerous dynamic code.
const RED_FLAG_PATTERNS: Array<{ re: RegExp; severity: Issue['severity']; message: string; kind: string }> = [
  // Dynamic code execution
  { re: /\beval\s*\(/g,          severity: 'critical', message: "Use of eval() — allows arbitrary code execution",            kind: 'security.eval' },
  { re: /new\s+Function\s*\(/g,  severity: 'major',    message: "Dynamic Function() constructor — acts like eval",            kind: 'security.dynamic-function' },
  { re: /setTimeout\s*\(\s*["'`]/g, severity: 'major', message: "setTimeout called with a string — evaluated as code (eval-like)", kind: 'security.settimeout-string' },
  { re: /\bexec\s*\(/g,          severity: 'major',    message: "exec() — shell execution, validate inputs carefully",        kind: 'security.exec' },
  { re: /child_process\.(exec|execSync)\s*\(\s*[^"']*[+`$]/g, severity: 'critical', message: "child_process exec with interpolated input — command injection risk", kind: 'security.shell-injection' },

  // XSS / DOM injection
  { re: /document\.write\s*\(/g, severity: 'major',    message: "document.write() — XSS risk and blocks parsing",             kind: 'security.document-write' },
  { re: /innerHTML\s*=/g,        severity: 'minor',    message: "innerHTML assignment — sanitize inputs to avoid XSS",         kind: 'security.inner-html' },
  { re: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html/g, severity: 'minor', message: "React dangerouslySetInnerHTML — ensure HTML is sanitized", kind: 'security.react-dangerous-html' },

  // SQL injection
  { re: /\b(SELECT|INSERT|UPDATE|DELETE)\b[^;`"']{0,200}\+\s*\w+/gi, severity: 'major', message: "SQL string concatenation — use parameterized queries instead", kind: 'security.sql-concat' },
  { re: /query\s*\(\s*[`'"][^`'"]*\$\{/g, severity: 'major', message: "SQL query with template-string interpolation — use parameterized queries", kind: 'security.sql-template' },

  // Weak crypto & insecure randomness
  { re: /createHash\s*\(\s*['"](md5|sha1)['"]\s*\)/gi, severity: 'major', message: "Weak hash algorithm (MD5/SHA1) — use SHA-256 or bcrypt for passwords", kind: 'security.weak-hash' },
  { re: /Math\.random\s*\(\s*\)[^;]{0,120}(token|secret|password|key|salt|nonce|id)/gi, severity: 'major', message: "Math.random() used for security value — use crypto.randomBytes / crypto.getRandomValues", kind: 'security.insecure-random' },

  // Disabled TLS / CORS misconfig
  { re: /rejectUnauthorized\s*:\s*false/g, severity: 'critical', message: "TLS verification disabled (rejectUnauthorized: false)", kind: 'security.tls-disabled' },
  { re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/g, severity: 'critical', message: "NODE_TLS_REJECT_UNAUTHORIZED=0 — disables all certificate validation", kind: 'security.tls-env-disabled' },
  { re: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/g, severity: 'minor', message: "Wildcard CORS (Access-Control-Allow-Origin: *) — consider restricting origins", kind: 'security.cors-wildcard' },
  { re: /verify\s*=\s*False/g, severity: 'major', message: "Python requests/verify=False — disables SSL verification", kind: 'security.py-ssl-off' },

  // Unsafe deserialization
  { re: /\bpickle\.loads?\s*\(/g, severity: 'major', message: "Python pickle.load/loads — deserializing untrusted data allows code execution", kind: 'security.pickle' },
  { re: /\bunserialize\s*\(/g,    severity: 'major', message: "PHP unserialize() — object-injection risk on untrusted input",                 kind: 'security.php-unserialize' },
  { re: /yaml\.load\s*\([^,)]*\)/g, severity: 'major', message: "yaml.load without Loader — use yaml.safe_load / SafeLoader",               kind: 'security.yaml-load' },

  // Secrets
  { re: /password\s*=\s*['"][^'"]{4,}['"]/gi,     severity: 'critical', message: "Hardcoded password literal",              kind: 'security.hardcoded-password' },
  { re: /api[_-]?key\s*=\s*['"][^'"]{8,}['"]/gi,  severity: 'critical', message: "Hardcoded API key literal",               kind: 'security.hardcoded-api-key' },
  { re: /secret\s*=\s*['"][^'"]{8,}['"]/gi,       severity: 'critical', message: "Hardcoded secret literal",                kind: 'security.hardcoded-secret' },
  { re: /bearer\s+[A-Za-z0-9_-]{20,}/gi,          severity: 'critical', message: "Hardcoded bearer token",                  kind: 'security.hardcoded-bearer' },
  { re: /AKIA[0-9A-Z]{16}/g,                      severity: 'critical', message: "AWS access key ID embedded in source",    kind: 'security.aws-key' },
  { re: /AIza[0-9A-Za-z_-]{35}/g,                 severity: 'critical', message: "Google API key embedded in source",       kind: 'security.google-key' },
  { re: /sk_live_[0-9a-zA-Z]{24,}/g,              severity: 'critical', message: "Stripe live secret key embedded in source", kind: 'security.stripe-live-key' },
  { re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, severity: 'critical', message: "Private key embedded in source", kind: 'security.private-key' },

  // Code quality markers
  { re: /TODO|FIXME|XXX|HACK/g,  severity: 'info',     message: "Unfinished code marker (TODO/FIXME/HACK)",                    kind: 'quality.todo' },
]

// ─── Line counting ─────────────────────────────────────────────────

interface LineCounts { loc: number; blank: number; comment: number }

function countLines(content: string, lang: LanguageDef): LineCounts {
  const out: LineCounts = { loc: 0, blank: 0, comment: 0 }
  const lines = content.split(/\r?\n/)
  let inBlock: [string, string] | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line === '') { out.blank++; continue }

    if (inBlock) {
      out.comment++
      if (line.includes(inBlock[1])) inBlock = null
      continue
    }

    const lineComment = lang.lineComment?.find((c) => line.startsWith(c))
    if (lineComment) { out.comment++; continue }

    const blockStart = lang.blockComment?.find((pair) => line.startsWith(pair[0]))
    if (blockStart) {
      out.comment++
      if (!line.slice(blockStart[0].length).includes(blockStart[1])) inBlock = blockStart
      continue
    }

    out.loc++
  }

  return out
}

// ─── Dependency parsing ───────────────────────────────────────────

function parsePackageJson(content: string, manifest: string): DependencyInfo[] {
  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const out: DependencyInfo[] = []
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      out.push({ manifest, name, version, dev: false })
    }
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      out.push({ manifest, name, version, dev: true })
    }
    return out
  } catch { return [] }
}

function parseComposerJson(content: string, manifest: string): DependencyInfo[] {
  try {
    const pkg = JSON.parse(content) as {
      require?: Record<string, string>
      'require-dev'?: Record<string, string>
    }
    const out: DependencyInfo[] = []
    for (const [name, version] of Object.entries(pkg.require || {})) {
      out.push({ manifest, name, version, dev: false })
    }
    for (const [name, version] of Object.entries(pkg['require-dev'] || {})) {
      out.push({ manifest, name, version, dev: true })
    }
    return out
  } catch { return [] }
}

function parseRequirementsTxt(content: string, manifest: string): DependencyInfo[] {
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const match = l.match(/^([A-Za-z0-9_.\-]+)\s*(?:[=<>!~]=?\s*(.+))?$/)
      if (!match) return null
      return { manifest, name: match[1], version: match[2], dev: false } as DependencyInfo
    })
    .filter((x): x is DependencyInfo => x !== null)
}

function parseGemfile(content: string, manifest: string): DependencyInfo[] {
  const out: DependencyInfo[] = []
  const re = /gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    out.push({ manifest, name: m[1], version: m[2], dev: false })
  }
  return out
}

type ManifestParser = (content: string, manifest: string) => DependencyInfo[]

const MANIFEST_PARSERS: Record<string, ManifestParser> = {
  'package.json': parsePackageJson,
  'composer.json': parseComposerJson,
  'requirements.txt': parseRequirementsTxt,
  'Gemfile': parseGemfile,
}

// ─── Scoring ───────────────────────────────────────────────────────

interface Phase2Signals {
  duplicationRatio: number
  maxComplexity: number
  complexFunctionCount: number
  testRatio: number
  hasTests: boolean
}

const SEV_PENALTY: Record<Issue['severity'], number> = { critical: 8, major: 3, minor: 1, info: 0 }

function commentRatioPenalty(metrics: Metrics): number {
  if (metrics.totalLoc <= 100) return 0
  if (metrics.commentRatio < 0.03) return 8
  if (metrics.commentRatio < 0.05) return 4
  if (metrics.commentRatio > 0.6) return 5
  return 0
}

function issuesPenalty(issues: Issue[]): number {
  let p = 0
  for (const iss of issues) p += SEV_PENALTY[iss.severity]
  return p
}

function structurePenalty(metrics: Metrics): number {
  let p = 0
  if (metrics.avgFileLoc > 400) p += 5
  if (metrics.avgFileLoc > 800) p += 5
  if (metrics.maxDirDepth > 10) p += 3
  return p
}

function duplicationPenalty(ratio: number): number {
  if (ratio > 0.15) return 10
  if (ratio > 0.08) return 5
  if (ratio > 0.03) return 2
  return 0
}

function complexityPenalty(p2: Phase2Signals): number {
  let p = 0
  if (p2.maxComplexity > 40) p += 8
  else if (p2.maxComplexity > 25) p += 4
  p += Math.min(10, p2.complexFunctionCount)
  return p
}

function testBonus(metrics: Metrics, p2: Phase2Signals): number {
  if (!p2.hasTests) return metrics.totalLoc > 500 ? -5 : 0
  if (p2.testRatio >= 0.3) return 3
  if (p2.testRatio >= 0.1) return 1
  return 0
}

function computeQualityScore(metrics: Metrics, issues: Issue[], p2: Phase2Signals): number {
  const score = 100
    - commentRatioPenalty(metrics)
    - Math.min(20, metrics.godFileCount * 3)
    - issuesPenalty(issues)
    - structurePenalty(metrics)
    - duplicationPenalty(p2.duplicationRatio)
    - complexityPenalty(p2)
    + testBonus(metrics, p2)

  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreToGrade(score: number): Report['grade'] {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

// Tiered base $ from LOC. Bigger codebases are worth more, with diminishing
// returns. 500 LOC ~ $43; 2,000 ~ $103; 10,000 ~ $268; 50,000 ~ $658.
function priceBaseFromLoc(loc: number): number {
  if (loc < 200) return 15 + loc * 0.05
  if (loc < 1000) return 25 + (loc - 200) * 0.06
  if (loc < 5000) return 73 + (loc - 1000) * 0.03
  if (loc < 20000) return 193 + (loc - 5000) * 0.015
  return 418 + Math.min(loc - 20000, 50000) * 0.008
}

// Complexity bonus: sophistication pays, runaway complexity doesn't.
function complexityMultiplier(maxComplexity: number): number {
  let m = 1
  if (maxComplexity >= 8) m += 0.05
  if (maxComplexity >= 15) m += 0.05
  if (maxComplexity >= 25) m += 0.1
  if (maxComplexity > 50) m -= 0.15
  return m
}

// Codebases with real tests are worth ~5–20% more to buyers.
function testMultiplier(p2: Phase2Signals): number {
  if (!p2.hasTests) return 1
  if (p2.testRatio >= 0.3) return 1.2
  if (p2.testRatio >= 0.1) return 1.1
  return 1.05
}

function priceRationale(metrics: Metrics, score: number, p2: Phase2Signals): string {
  const parts = [
    `${metrics.totalLoc.toLocaleString()} lines of source`,
    `quality ${score}/100`,
  ]
  if (p2.maxComplexity > 0) parts.push(`peak complexity ${p2.maxComplexity}`)
  parts.push(p2.hasTests ? `tests present (ratio ${p2.testRatio.toFixed(2)})` : 'no tests detected')
  return `Based on ${parts.join(', ')}.`
}

// Fair-value estimate. Anchored to real CodeCanyon/GitHub-marketplace prices
// for comparable work (~$25–$150 for small scripts, $150–$500 for full apps).
function suggestPrice(metrics: Metrics, score: number, p2: Phase2Signals): Report['suggestedPrice'] {
  const base = priceBaseFromLoc(metrics.totalLoc)
  const qualityMult = 0.55 + (score / 100) * 0.7
  const center = base * qualityMult * complexityMultiplier(p2.maxComplexity) * testMultiplier(p2)
  const min = Math.max(10, Math.floor((center * 0.75) / 5) * 5)
  const max = Math.max(min + 10, Math.ceil((center * 1.35) / 5) * 5)
  return { minUsd: min, maxUsd: max, rationale: priceRationale(metrics, score, p2) }
}

// ─── Accumulator ──────────────────────────────────────────────────

interface Accumulator {
  issues: Issue[]
  deps: DependencyInfo[]
  langStats: Map<string, { files: number; loc: number }>
  totalFiles: number
  totalLoc: number
  totalBlank: number
  totalComment: number
  maxFileLoc: number
  maxDirDepth: number
  godFileCount: number
  binaryFileCount: number
  generatedFileCount: number
  bytesRead: number
  aiDetector: AiDetector
  duplicationDetector: DuplicationDetector
  complexityScanner: ComplexityScanner
  testScanner: TestScanner
}

function makeAccumulator(): Accumulator {
  return {
    issues: [],
    deps: [],
    langStats: new Map(),
    totalFiles: 0,
    totalLoc: 0,
    totalBlank: 0,
    totalComment: 0,
    maxFileLoc: 0,
    maxDirDepth: 0,
    godFileCount: 0,
    binaryFileCount: 0,
    generatedFileCount: 0,
    bytesRead: 0,
    aiDetector: new AiDetector(),
    duplicationDetector: new DuplicationDetector(),
    complexityScanner: new ComplexityScanner(),
    testScanner: new TestScanner(),
  }
}

// ─── Per-entry helpers ────────────────────────────────────────────

function readEntryAsString(entry: IZipEntry): string | null {
  try {
    return entry.getData().toString('utf8')
  } catch {
    return null
  }
}

function extractDependencies(
  entry: IZipEntry,
  fileName: string,
  relPath: string,
  acc: Accumulator
): boolean {
  const parser = MANIFEST_PARSERS[fileName]
  if (!parser) return false

  const content = readEntryAsString(entry)
  if (content !== null) {
    acc.bytesRead += content.length
    acc.deps.push(...parser(content, relPath))
  }
  return true
}

function scanRedFlags(content: string, relPath: string, acc: Accumulator): void {
  const sample = content.length > RED_FLAG_SAMPLE_BYTES ? content.slice(0, RED_FLAG_SAMPLE_BYTES) : content
  for (const flag of RED_FLAG_PATTERNS) {
    flag.re.lastIndex = 0
    const match = flag.re.exec(sample)
    if (!match) continue

    const before = sample.slice(0, match.index)
    const line = before.split(/\r?\n/).length
    acc.issues.push({
      severity: flag.severity,
      kind: flag.kind,
      message: flag.message,
      file: relPath,
      line,
    })
  }
}

function recordSourceFile(
  content: string,
  lang: LanguageDef,
  relPath: string,
  ext: string,
  acc: Accumulator
): void {
  const counts = countLines(content, lang)
  acc.totalFiles++
  acc.totalLoc += counts.loc
  acc.totalBlank += counts.blank
  acc.totalComment += counts.comment

  if (counts.loc > acc.maxFileLoc) acc.maxFileLoc = counts.loc
  if (counts.loc >= GOD_FILE_LOC) {
    acc.godFileCount++
    acc.issues.push({
      severity: 'minor',
      kind: 'maintainability.god-file',
      message: `Large file (${counts.loc.toLocaleString()} LOC) — consider splitting into smaller modules.`,
      file: relPath,
    })
  }

  const prev = acc.langStats.get(lang.name) || { files: 0, loc: 0 }
  acc.langStats.set(lang.name, { files: prev.files + 1, loc: prev.loc + counts.loc })

  scanRedFlags(content, relPath, acc)
  acc.aiDetector.scanFile(content, relPath, ext)
  acc.duplicationDetector.scanFile(content, relPath)
  acc.complexityScanner.scanFile(content, relPath, ext)
  acc.testScanner.scanFile(content, relPath, counts.loc)
}

function processEntry(entry: IZipEntry, acc: Accumulator): void {
  const relPath = entry.entryName.replace(/\\/g, '/')
  if (shouldIgnorePath(relPath)) return

  const depth = relPath.split('/').length - 1
  if (depth > acc.maxDirDepth) acc.maxDirDepth = depth

  const fileName = relPath.split('/').pop() || relPath

  if (isGeneratedFile(fileName)) {
    acc.generatedFileCount++
    return
  }

  if (extractDependencies(entry, fileName, relPath, acc)) return

  const lastDot = fileName.lastIndexOf('.')
  const ext = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : ''
  const lang = getLanguageByExt(ext)

  if (!lang?.isSource) {
    acc.binaryFileCount++
    return
  }

  if (entry.header.size > MAX_TEXT_FILE_BYTES) {
    acc.binaryFileCount++
    return
  }

  const content = readEntryAsString(entry)
  if (content === null) {
    acc.binaryFileCount++
    return
  }

  acc.bytesRead += content.length
  recordSourceFile(content, lang, relPath, ext, acc)
}

function finalizeLanguages(acc: Accumulator): LanguageBreakdown[] {
  return Array.from(acc.langStats.entries())
    .map(([name, s]) => ({
      name,
      files: s.files,
      loc: s.loc,
      percent: acc.totalLoc > 0 ? Math.round((s.loc / acc.totalLoc) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.loc - a.loc)
}

// ─── Main entrypoint ───────────────────────────────────────────────

export async function analyzeZip(zipBuffer: Buffer): Promise<Report> {
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()
  const acc = makeAccumulator()

  for (const entry of entries) {
    if (entry.isDirectory) continue
    if (acc.bytesRead > MAX_TOTAL_BYTES) {
      acc.issues.push({
        severity: 'info',
        kind: 'analysis.truncated',
        message: `Archive exceeded ${MAX_TOTAL_BYTES / 1024 / 1024} MB — analysis truncated.`,
      })
      break
    }
    processEntry(entry, acc)
  }

  const avgFileLoc = acc.totalFiles > 0 ? Math.round(acc.totalLoc / acc.totalFiles) : 0
  const commentRatio = acc.totalLoc > 0 ? acc.totalComment / (acc.totalLoc + acc.totalComment) : 0

  const metrics: Metrics = {
    totalFiles: acc.totalFiles,
    totalLoc: acc.totalLoc,
    totalBlankLines: acc.totalBlank,
    totalCommentLines: acc.totalComment,
    commentRatio: Math.round(commentRatio * 1000) / 1000,
    avgFileLoc,
    maxFileLoc: acc.maxFileLoc,
    maxDirDepth: acc.maxDirDepth,
    godFileCount: acc.godFileCount,
    binaryFileCount: acc.binaryFileCount,
    generatedFileCount: acc.generatedFileCount,
  }

  const duplication = acc.duplicationDetector.finalize()
  const complexity = acc.complexityScanner.finalize()
  const testCoverage = acc.testScanner.finalize()

  pushPhase2Issues(acc, duplication, complexity, testCoverage, metrics)

  const p2: Phase2Signals = {
    duplicationRatio: duplication.ratio,
    maxComplexity: complexity.maxComplexity,
    complexFunctionCount: complexity.complexFunctionCount,
    testRatio: testCoverage.ratio,
    hasTests: testCoverage.testFiles > 0,
  }

  const qualityScore = computeQualityScore(metrics, acc.issues, p2)
  const grade = scoreToGrade(qualityScore)

  const sevOrder: Record<Issue['severity'], number> = { critical: 0, major: 1, minor: 2, info: 3 }
  acc.issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])

  return {
    analyzerVersion: ANALYZER_VERSION,
    analyzedAt: new Date().toISOString(),
    qualityScore,
    grade,
    metrics,
    languages: finalizeLanguages(acc),
    dependencies: acc.deps,
    issues: acc.issues,
    suggestedPrice: suggestPrice(metrics, qualityScore, p2),
    aiDetection: acc.aiDetector.finalize(),
    duplication,
    complexity,
    testCoverage,
  }
}

// Turn Phase 2 findings into user-facing issue rows.
function pushPhase2Issues(
  acc: Accumulator,
  duplication: ReturnType<DuplicationDetector['finalize']>,
  complexity: ReturnType<ComplexityScanner['finalize']>,
  testCoverage: ReturnType<TestScanner['finalize']>,
  metrics: Metrics,
): void {
  // Duplication — one issue per large clone block
  for (const block of duplication.topBlocks.slice(0, 10)) {
    if (block.occurrences.length < 2) continue
    const first = block.occurrences[0]
    const sev: Issue['severity'] = block.occurrences.length >= 4 ? 'major' : 'minor'
    acc.issues.push({
      severity: sev,
      kind: 'maintainability.duplication',
      message: `Duplicate ${block.lines}-line block found in ${block.occurrences.length} places — consider extracting a shared helper.`,
      file: first.file,
      line: first.line,
    })
  }

  // Complexity — one issue per very complex function (top 5)
  for (const fn of complexity.topOffenders.slice(0, 5)) {
    if (fn.complexity < 15) continue
    const sev: Issue['severity'] = fn.complexity >= 25 ? 'major' : 'minor'
    acc.issues.push({
      severity: sev,
      kind: 'maintainability.complex-function',
      message: `Function "${fn.name}" has cyclomatic complexity ${fn.complexity} (${fn.loc} LOC) — hard to test and maintain.`,
      file: fn.file,
      line: fn.line,
    })
  }

  // No tests — one info-level issue for meaningful codebases
  if (testCoverage.testFiles === 0 && metrics.totalLoc > 500) {
    acc.issues.push({
      severity: 'info',
      kind: 'quality.no-tests',
      message: 'No test files detected — automated tests help buyers trust the code works.',
    })
  }
}
