// Public shape of the analysis report stored in product_analyses.report.
// Keep this stable — the UI reads from it.

import type { AiDetectionResult } from './ai-detector'
import type { DuplicationResult } from './duplication'
import type { ComplexityResult } from './complexity'
import type { TestDetectionResult } from './tests'
import type { CveScanResult } from './cve'

export type IssueSeverity = 'info' | 'minor' | 'major' | 'critical'

export interface Issue {
  severity: IssueSeverity
  kind: string
  message: string
  file?: string
  line?: number
}

export interface LanguageBreakdown {
  name: string
  files: number
  loc: number
  percent: number
}

export interface DependencyInfo {
  manifest: string
  name: string
  version?: string
  dev?: boolean
}

export interface Metrics {
  totalFiles: number
  totalLoc: number
  totalBlankLines: number
  totalCommentLines: number
  commentRatio: number
  avgFileLoc: number
  maxFileLoc: number
  maxDirDepth: number
  godFileCount: number
  binaryFileCount: number
  generatedFileCount: number
}

export interface Report {
  analyzerVersion: string
  analyzedAt: string
  qualityScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  metrics: Metrics
  languages: LanguageBreakdown[]
  dependencies: DependencyInfo[]
  issues: Issue[]
  suggestedPrice: { minUsd: number; maxUsd: number; rationale: string }
  aiDetection?: AiDetectionResult
  duplication?: DuplicationResult
  complexity?: ComplexityResult
  testCoverage?: TestDetectionResult
  cveScan?: CveScanResult
}
