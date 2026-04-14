// Heuristic AI-generated-code detector. 100% local pattern matching — no API
// calls, no paid services. Looks for "tells" that are much more common in
// LLM-produced code than in human code, weights them, normalizes against
// total LOC, and produces a confidence score.
//
// This is NOT a definitive verdict. It's evidence. We show the matched
// patterns (not just a number) so the buyer/seller can judge for themselves.

export type AiSignalStrength = 'strong' | 'medium' | 'weak'

export interface AiSignal {
  strength: AiSignalStrength
  kind: string
  description: string
  matches: number
  exampleFile?: string
  exampleLine?: number
  exampleSnippet?: string
}

export interface AiDetectionResult {
  /** 0-100 confidence that the code is AI-generated. */
  probability: number
  /** Plain-language verdict shown in UI. */
  verdict: 'likely-human' | 'mixed' | 'likely-ai' | 'almost-certainly-ai'
  /** Signals that contributed, sorted by weight. */
  signals: AiSignal[]
  /** Total pattern matches across all signals. */
  totalMatches: number
  /** LOC scanned (excluding generated files). */
  locScanned: number
}

interface Pattern {
  strength: AiSignalStrength
  kind: string
  description: string
  re: RegExp
  /** Skip this pattern for files with these extensions. */
  skipExts?: string[]
}

// Patterns picked for high specificity — they catch AI-authored code much
// more often than human-authored code. Each is documented with why it's a tell.
const PATTERNS: Pattern[] = [
  // ─── Strong tells ─────────────────────────────────────────────────
  {
    strength: 'strong',
    kind: 'placeholder.lorem-ipsum',
    description: 'Lorem ipsum placeholder text — AI default for sample data',
    re: /\bLorem\s+ipsum\s+dolor\s+sit\s+amet/gi,
  },
  {
    strength: 'strong',
    kind: 'placeholder.john-doe',
    description: 'Common AI placeholder names (John Doe / Jane Doe / example@email.com)',
    re: /["'](John Doe|Jane Doe|John Smith|example@(?:example|email|test)\.(?:com|org)|user@example\.com)["']/g,
  },
  {
    strength: 'strong',
    kind: 'comment.implement-here',
    description: 'Boilerplate "Your code here" / "Implementation goes here" comments',
    re: /\/\/\s*(Your code here|Implementation goes here|Add your code|TODO:\s*Implement (this|the .{0,50}))/gi,
  },
  {
    strength: 'strong',
    kind: 'comment.over-explanatory',
    description: '"This function/method/class does X" comments — AI narrates what code already says',
    re: /\/\/\s+This\s+(function|method|class|component|variable|constant|handler|helper|utility)\s+(will\s+)?(returns?|handles?|manages?|represents?|creates?|performs?|does|is (used|responsible))/gi,
  },
  {
    strength: 'strong',
    kind: 'comment.emoji-heavy',
    description: 'Emoji in code comments (AI loves ✅ ❌ 📝 🚀 🎉)',
    re: /\/\/[^\n]*[\u2705\u274C\u1F4DD\u1F680\u1F389\u1F4A1\u1F527\u26A0\u1F512\u1F511\u2728\u1F3AF\u1F4CA\u1F4C8\u1F4C9\u1F504\u1F525]/g,
  },
  {
    strength: 'strong',
    kind: 'console.friendly-log',
    description: 'Friendly console.log banners ("Success!", "Hello World")',
    re: /console\.(log|info)\s*\(\s*["'`](?:Success!?|Hello,?\s+World!?|Done!?|Operation (completed|successful)!?|Successfully\s+\w+!?)["'`]/gi,
  },
  {
    strength: 'strong',
    kind: 'jsdoc.every-function',
    description: 'JSDoc block before every declaration — AI over-documents; humans usually don\'t',
    // Detects /** */ followed by function/const/class declaration — counted per file
    re: /\/\*\*[\s\S]{5,400}?\*\/\s*\n\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|class|interface|type)\s/g,
  },

  // ─── Medium tells ─────────────────────────────────────────────────
  {
    strength: 'medium',
    kind: 'comment.redundant-assignment',
    description: 'Redundant comments on simple assignments ("// Set X to Y")',
    re: /\/\/\s+(Set|Assign|Initialize|Define|Declare|Create)\s+(the\s+)?\w+\s+(to|as|with|equal to)\s/gi,
  },
  {
    strength: 'medium',
    kind: 'comment.first-line-explainer',
    description: 'Plain-English explainer comment on first line of function body',
    re: /\{\s*\n\s*\/\/\s+(First|Check|Validate|Initialize|Get|Set|Create|Make|Define|Extract|Compute|Calculate|Generate|Build|Prepare|Loop|Iterate)\s+\w+/g,
  },
  {
    strength: 'medium',
    kind: 'error.generic-console-error',
    description: "Identical `catch (error) { console.error('Error:', error) }` pattern",
    re: /catch\s*\(\s*(error|err|e)\s*\)\s*\{\s*console\.error\s*\(\s*["']Error:?\s*["']\s*,\s*(error|err|e)\s*\)\s*\}?/g,
  },
  {
    strength: 'medium',
    kind: 'comment.todo-complete-sentence',
    description: 'TODO comments written as complete sentences — AI style',
    re: /\/\/\s+TODO:\s+[A-Z][a-z]+(\s+\w+){4,}\./g,
  },
  {
    strength: 'medium',
    kind: 'variable.placeholder-name',
    description: 'Boilerplate variable names (myVariable, myData, newItem, exampleData, sampleData)',
    re: /\b(const|let|var)\s+(myVariable|myData|myResult|myValue|myItem|myObject|myArray|newItem|exampleData|sampleData|tempResult|tempValue)\b/g,
  },
  {
    strength: 'medium',
    kind: 'style.defensive-chain',
    description: 'Excessive defensive property chains (a && a.b && a.b.c && a.b.c.d)',
    re: /\w+\s*&&\s*\w+\.\w+\s*&&\s*\w+\.\w+\.\w+\s*&&\s*\w+\.\w+\.\w+\.\w+/g,
  },
  {
    strength: 'medium',
    kind: 'readme.generated-marker',
    description: "README/header claiming code was generated or assisted by AI",
    re: /\b(Generated|Written|Created|Produced|Authored)\s+(by|with|using)\s+(AI|ChatGPT|Claude|Copilot|GPT|Gemini|Cursor|LLM)/gi,
  },

  // ─── Weak tells (alone mean little, together add up) ─────────────
  {
    strength: 'weak',
    kind: 'style.arrow-only',
    description: 'Every function is an arrow function (no function declarations at all)',
    re: /=\s*(async\s+)?\([^)]*\)\s*=>/g,
  },
  {
    strength: 'weak',
    kind: 'style.const-heavy',
    description: 'Uses `const` exclusively (no `let` anywhere)',
    re: /^\s*const\s+\w+\s*=/gm,
  },
  {
    strength: 'weak',
    kind: 'comment.block-divider',
    description: 'Decorative comment dividers (// ═══ / // --- / // ###)',
    re: /\/\/\s*[=─━\u2550\-#]{5,}/g,
  },
]

/** Cap per-file match counts so one giant AI file can't dominate the score. */
const PER_FILE_CAP_BY_STRENGTH: Record<AiSignalStrength, number> = {
  strong: 5,
  medium: 10,
  weak: 20,
}

/** Weight applied to each match when computing the final probability. */
const WEIGHT_BY_STRENGTH: Record<AiSignalStrength, number> = {
  strong: 10,
  medium: 4,
  weak: 1,
}

interface SignalAccumulator {
  strength: AiSignalStrength
  kind: string
  description: string
  matches: number
  exampleFile?: string
  exampleLine?: number
  exampleSnippet?: string
}

export class AiDetector {
  private accumulators = new Map<string, SignalAccumulator>()
  private locScanned = 0

  /** Scan one source file's content and add matches to the running tally. */
  scanFile(content: string, relPath: string, ext: string): void {
    // Count LOC for normalization (rough: non-blank non-comment lines)
    const lines = content.split(/\r?\n/)
    this.locScanned += lines.filter((l) => l.trim() && !l.trim().startsWith('//')).length

    // Only scan a reasonable slice per file to keep costs bounded
    const sample = content.length > 300_000 ? content.slice(0, 300_000) : content

    for (const p of PATTERNS) {
      if (p.skipExts?.includes(ext)) continue
      p.re.lastIndex = 0

      // Count matches (capped per-file)
      let matches = 0
      let firstMatchIndex = -1
      let m: RegExpExecArray | null
      const cap = PER_FILE_CAP_BY_STRENGTH[p.strength]
      while ((m = p.re.exec(sample)) && matches < cap) {
        if (matches === 0) firstMatchIndex = m.index
        matches++
        if (m.index === p.re.lastIndex) p.re.lastIndex++ // avoid zero-width loop
      }

      if (matches === 0) continue

      const acc = this.accumulators.get(p.kind) || {
        strength: p.strength,
        kind: p.kind,
        description: p.description,
        matches: 0,
      }
      acc.matches += matches

      // Record a representative example if we don't have one yet
      if (!acc.exampleFile && firstMatchIndex >= 0) {
        const before = sample.slice(0, firstMatchIndex)
        const line = before.split(/\r?\n/).length
        const snippetStart = Math.max(0, firstMatchIndex - 20)
        const snippetEnd = Math.min(sample.length, firstMatchIndex + 120)
        acc.exampleFile = relPath
        acc.exampleLine = line
        acc.exampleSnippet = sample.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim().slice(0, 160)
      }

      this.accumulators.set(p.kind, acc)
    }
  }

  /** Finalize and return the detection result. */
  finalize(): AiDetectionResult {
    const signals: AiSignal[] = Array.from(this.accumulators.values())
      .map((a) => ({
        strength: a.strength,
        kind: a.kind,
        description: a.description,
        matches: a.matches,
        exampleFile: a.exampleFile,
        exampleLine: a.exampleLine,
        exampleSnippet: a.exampleSnippet,
      }))
      .sort((a, b) => {
        const order = { strong: 0, medium: 1, weak: 2 }
        if (order[a.strength] !== order[b.strength]) return order[a.strength] - order[b.strength]
        return b.matches - a.matches
      })

    const totalMatches = signals.reduce((sum, s) => sum + s.matches, 0)
    const rawScore = signals.reduce(
      (sum, s) => sum + s.matches * WEIGHT_BY_STRENGTH[s.strength],
      0
    )

    // Normalize: matches per 100 LOC. Typical AI-heavy code lands at 5-20 raw
    // score per 100 LOC; human code usually <2. We map 0..8 per 100 LOC
    // onto 0..100% with a soft curve.
    const locBasis = Math.max(100, this.locScanned)
    const densityPer100 = (rawScore / locBasis) * 100

    // Soft logistic-ish mapping. 0=0%, 2=25%, 4=55%, 6=75%, 8+=90%
    let probability = Math.round(100 * (1 - 1 / (1 + Math.pow(densityPer100 / 3.5, 1.8))))
    if (densityPer100 === 0) probability = 0
    if (probability > 100) probability = 100
    if (probability < 0) probability = 0

    let verdict: AiDetectionResult['verdict'] = 'likely-human'
    if (probability >= 80) verdict = 'almost-certainly-ai'
    else if (probability >= 55) verdict = 'likely-ai'
    else if (probability >= 30) verdict = 'mixed'

    return {
      probability,
      verdict,
      signals,
      totalMatches,
      locScanned: this.locScanned,
    }
  }
}
