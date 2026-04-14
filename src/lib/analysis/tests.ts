// Test file detection — identifies which files look like tests and
// computes test-to-source ratio, a decent proxy for code quality.

export interface TestDetectionResult {
  testFiles: number
  testLoc: number
  sourceFiles: number
  sourceLoc: number
  /** testLoc / sourceLoc — a ratio, not a percentage. >0.3 is generally "well-tested". */
  ratio: number
  /** Frameworks we spotted evidence of, for reporting. */
  frameworks: string[]
}

// Paths that are clearly test code.
const TEST_PATH_RE = /(?:^|[\\/])(tests?|__tests__|__test__|specs?|features)[\\/]/i
const TEST_FILE_RE = /(?:[._-]|\/)(test|spec)s?\.[a-z]+$|_test\.(go|py)$|Test\.(java|kt|cs)$/i

// Framework fingerprints from file contents (first 4 KB)
const FRAMEWORK_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'Jest',      re: /\b(describe|test|it|expect)\s*\(/ },
  { name: 'Vitest',    re: /from\s+['"]vitest['"]/ },
  { name: 'Mocha',     re: /\b(describe|it)\s*\(/ }, // overlap with Jest; reported once
  { name: 'Playwright',re: /from\s+['"]@playwright\/test['"]/ },
  { name: 'Cypress',   re: /\bcy\.(visit|get|contains|click)/ },
  { name: 'PHPUnit',   re: /extends\s+TestCase\b/ },
  { name: 'Pytest',    re: /^\s*import\s+pytest\b/m },
  { name: 'RSpec',     re: /\bRSpec\.describe\b/ },
  { name: 'Go test',   re: /^\s*func\s+Test[A-Z]\w+\s*\(\s*t\s+\*testing\.T\s*\)/m },
  { name: 'JUnit',     re: /@Test\b/ },
]

export function isTestPath(relPath: string): boolean {
  return TEST_PATH_RE.test(relPath) || TEST_FILE_RE.test(relPath)
}

export class TestScanner {
  private testFiles = 0
  private testLoc = 0
  private sourceFiles = 0
  private sourceLoc = 0
  private frameworks = new Set<string>()

  scanFile(content: string, relPath: string, loc: number): void {
    if (isTestPath(relPath)) {
      this.testFiles++
      this.testLoc += loc
      // sniff frameworks from a small sample
      const sample = content.slice(0, 4096)
      for (const f of FRAMEWORK_PATTERNS) {
        if (f.re.test(sample)) this.frameworks.add(f.name)
      }
    } else {
      this.sourceFiles++
      this.sourceLoc += loc
    }
  }

  finalize(): TestDetectionResult {
    const ratio = this.sourceLoc > 0 ? this.testLoc / this.sourceLoc : 0
    // Dedup Mocha when Jest is also present (their patterns overlap)
    if (this.frameworks.has('Jest') && this.frameworks.has('Mocha')) {
      this.frameworks.delete('Mocha')
    }
    return {
      testFiles: this.testFiles,
      testLoc: this.testLoc,
      sourceFiles: this.sourceFiles,
      sourceLoc: this.sourceLoc,
      ratio: Math.round(ratio * 1000) / 1000,
      frameworks: Array.from(this.frameworks).sort(),
    }
  }
}
