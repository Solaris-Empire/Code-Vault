// SonarQube-style code quality report card shown on product detail pages.
// Renders the saved analyzer output from public.product_analyses.
// Pure display component — no fetching logic here.

import Link from 'next/link'
import {
  Gauge,
  FileCode,
  Languages,
  Package,
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  Info,
  Sparkles,
  TrendingUp,
  Loader2,
  Bot,
  CheckCircle2,
  EyeOff,
  Copy,
  GitBranch,
  FlaskConical,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import type { Report, Issue } from '@/lib/analysis/types'
import type { AiSignal, AiSignalStrength } from '@/lib/analysis/ai-detector'
import type { VulnerabilityRow } from '@/lib/analysis/cve'

interface AnalysisRow {
  status: 'pending' | 'completed' | 'failed'
  error_message: string | null
  quality_score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  total_loc: number
  total_files: number
  dependency_count: number
  issue_count: number
  report: Report | Record<string, never>
  updated_at: string
}

function gradeColorClasses(grade: string) {
  switch (grade) {
    case 'A': return { bg: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-200', bgSoft: 'bg-green-50' }
    case 'B': return { bg: 'bg-lime-500',  text: 'text-lime-700',  ring: 'ring-lime-200',  bgSoft: 'bg-lime-50' }
    case 'C': return { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', bgSoft: 'bg-amber-50' }
    case 'D': return { bg: 'bg-orange-500',text: 'text-orange-700',ring: 'ring-orange-200',bgSoft: 'bg-orange-50' }
    default:  return { bg: 'bg-red-500',   text: 'text-red-700',   ring: 'ring-red-200',   bgSoft: 'bg-red-50' }
  }
}

function severityBadge(sev: Issue['severity']) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider'
  switch (sev) {
    case 'critical': return { cls: `${base} bg-red-100 text-red-700`, Icon: ShieldAlert }
    case 'major':    return { cls: `${base} bg-orange-100 text-orange-700`, Icon: AlertTriangle }
    case 'minor':    return { cls: `${base} bg-amber-100 text-amber-700`, Icon: AlertCircle }
    default:         return { cls: `${base} bg-gray-100 text-gray-600`, Icon: Info }
  }
}

interface CodeQualityReportProps {
  analysis: AnalysisRow | null
  /** If false, the AI-detection panel is hidden from buyers. Sellers/admins see it via `viewerCanSeeAi`. */
  showAiDetection?: boolean
  /** Seller-owning or admin viewer — always sees AI section regardless of showAiDetection. */
  viewerCanSeeAi?: boolean
  /** Slug for the product — used to link through to the full `/products/[slug]/analysis` page. */
  productSlug?: string
}

export function CodeQualityReport({
  analysis,
  showAiDetection = true,
  viewerCanSeeAi = false,
  productSlug,
}: CodeQualityReportProps) {
  // No analysis yet — show placeholder card
  if (!analysis) {
    return (
      <div className="card rounded-none p-6">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-5 w-5 text-(--brand-primary)" />
          <h2 className="text-xl font-bold">Code Quality Report</h2>
        </div>
        <p className="text-sm text-(--color-text-secondary)">
          No static analysis has been run for this product yet.
        </p>
      </div>
    )
  }

  if (analysis.status === 'pending') {
    return (
      <div className="card rounded-none p-6">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-5 w-5 text-(--brand-primary)" />
          <h2 className="text-xl font-bold">Code Quality Report</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analysis in progress… refresh in a moment.
        </div>
      </div>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <div className="card rounded-none p-6">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-5 w-5 text-(--brand-primary)" />
          <h2 className="text-xl font-bold">Code Quality Report</h2>
        </div>
        <p className="text-sm text-red-600">
          Analysis failed: {analysis.error_message || 'Unknown error'}
        </p>
      </div>
    )
  }

  const report = analysis.report as Report
  const grade = gradeColorClasses(analysis.grade)
  const issues = report.issues || []
  const languages = report.languages || []
  const metrics = report.metrics

  // Count issues by severity for the summary bar
  const sevCounts = { critical: 0, major: 0, minor: 0, info: 0 }
  for (const iss of issues) sevCounts[iss.severity]++

  return (
    <div className="card rounded-none p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-(--brand-primary)" />
          <h2 className="text-xl font-bold">Code Quality Report</h2>
        </div>
        <span className="text-xs text-(--color-text-muted)">
          v{report.analyzerVersion || '1.0.0'}
        </span>
      </div>

      {/* Big grade + score */}
      <div className="flex items-center gap-5 mb-6">
        <div
          className={`flex h-20 w-20 items-center justify-center text-4xl font-black text-white ${grade.bg} ring-4 ${grade.ring}`}
        >
          {analysis.grade}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{analysis.quality_score}</span>
            <span className="text-sm text-(--color-text-muted)">/ 100 quality score</span>
          </div>
          <p className={`text-sm font-medium ${grade.text} mt-1`}>
            {analysis.grade === 'A' && 'Excellent — clean, well-structured code.'}
            {analysis.grade === 'B' && 'Good — minor improvements possible.'}
            {analysis.grade === 'C' && 'Fair — some quality concerns to address.'}
            {analysis.grade === 'D' && 'Poor — noticeable quality issues.'}
            {analysis.grade === 'F' && 'Failing — significant issues found.'}
          </p>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricTile icon={FileCode} label="Lines of Code" value={metrics?.totalLoc?.toLocaleString() || '—'} />
        <MetricTile icon={Package}  label="Files"         value={metrics?.totalFiles?.toLocaleString() || '—'} />
        <MetricTile icon={Package}  label="Dependencies"  value={analysis.dependency_count.toString()} />
        <MetricTile icon={AlertCircle} label="Issues"     value={analysis.issue_count.toString()} />
      </div>

      {/* Detail metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 text-sm">
          <DetailRow label="Comment ratio" value={`${(metrics.commentRatio * 100).toFixed(1)}%`} />
          <DetailRow label="Avg file LOC" value={metrics.avgFileLoc.toString()} />
          <DetailRow label="Largest file" value={`${metrics.maxFileLoc.toLocaleString()} LOC`} />
          <DetailRow label="God files" value={metrics.godFileCount.toString()} />
        </div>
      )}

      {/* Language breakdown */}
      {languages.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-4 w-4 text-(--color-text-muted)" />
            <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">Languages</h3>
          </div>
          <div className="space-y-2">
            {languages.slice(0, 6).map((l) => (
              <div key={l.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-800">{l.name}</span>
                  <span className="text-(--color-text-muted)">{l.percent}% · {l.loc.toLocaleString()} LOC · {l.files} files</span>
                </div>
                <div className="h-1.5 bg-gray-100 overflow-hidden">
                  <div className="h-full bg-(--brand-primary)" style={{ width: `${l.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 2: Duplication */}
      {report.duplication && report.duplication.linesScanned > 0 && (
        <DuplicationPanel duplication={report.duplication} />
      )}

      {/* Phase 2: Complexity */}
      {report.complexity && report.complexity.totalFunctions > 0 && (
        <ComplexityPanel complexity={report.complexity} />
      )}

      {/* Phase 2: Test coverage */}
      {report.testCoverage && (
        <TestCoveragePanel test={report.testCoverage} />
      )}

      {/* Phase 3: CVE scan */}
      {report.cveScan && (
        <CveScanPanel scan={report.cveScan} />
      )}

      {/* No issues banner — explains what was actually scanned for */}
      {analysis.issue_count === 0 && (
        <div className="mb-6 border border-green-100 bg-green-50/60 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">No issues detected</p>
            <p className="text-xs text-(--color-text-muted) mt-1 leading-relaxed">
              Scanned for: <code className="bg-white px-1">eval()</code>, dynamic <code className="bg-white px-1">new Function()</code>,
              <code className="bg-white px-1">document.write</code>, unsafe <code className="bg-white px-1">innerHTML=</code>,
              shell <code className="bg-white px-1">exec()</code>, hardcoded passwords/API keys/secrets,
              embedded private keys, TODO/FIXME markers, files over {500} LOC (god files),
              and excessive directory depth.
            </p>
          </div>
        </div>
      )}

      {/* Issues summary */}
      {analysis.issue_count > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
            Issues ({analysis.issue_count})
          </h3>
          <div className="flex gap-2 mb-3">
            {sevCounts.critical > 0 && <SevPill count={sevCounts.critical} label="Critical" cls="bg-red-50 text-red-700 border-red-200" />}
            {sevCounts.major > 0 &&    <SevPill count={sevCounts.major}    label="Major"    cls="bg-orange-50 text-orange-700 border-orange-200" />}
            {sevCounts.minor > 0 &&    <SevPill count={sevCounts.minor}    label="Minor"    cls="bg-amber-50 text-amber-700 border-amber-200" />}
            {sevCounts.info > 0 &&     <SevPill count={sevCounts.info}     label="Info"     cls="bg-gray-50 text-gray-600 border-gray-200" />}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {issues.slice(0, 30).map((iss, i) => {
              const b = severityBadge(iss.severity)
              return (
                <div key={i} className="flex items-start gap-3 text-sm border border-gray-100 bg-gray-50/50 p-3">
                  <span className={b.cls}>
                    <b.Icon className="h-3 w-3" />
                    {iss.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800">{iss.message}</p>
                    {iss.file && (
                      <p className="text-xs text-(--color-text-muted) mt-0.5 font-mono truncate">
                        {iss.file}{iss.line ? `:${iss.line}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            {issues.length > 30 && (
              <p className="text-xs text-(--color-text-muted) text-center pt-2">
                + {issues.length - 30} more issues
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI-generated-code detection */}
      {report.aiDetection && (showAiDetection || viewerCanSeeAi) && (
        <AiDetectionPanel
          detection={report.aiDetection}
          hiddenFromBuyers={!showAiDetection && viewerCanSeeAi}
        />
      )}

      {/* Suggested price */}
      {report.suggestedPrice && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-(--brand-primary)" />
            <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">Fair Value Estimate</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${report.suggestedPrice.minUsd} – ${report.suggestedPrice.maxUsd}
          </p>
          <p className="text-xs text-(--color-text-muted) mt-1 flex items-start gap-1">
            <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
            {report.suggestedPrice.rationale}
          </p>
        </div>
      )}

      {/* Full report link */}
      {productSlug && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <Link
            href={`/products/${productSlug}/analysis`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-primary) hover:underline"
          >
            View full analysis report <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">{label}</span>
        <Icon className="h-3.5 w-3.5 text-(--color-text-muted)" />
      </div>
      <span className="text-lg font-bold text-gray-900">{value}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-l-2 border-(--brand-primary)/40 pl-3">
      <span className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  )
}

function SevPill({ count, label, cls }: { count: number; label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <span className="font-bold">{count}</span> {label}
    </span>
  )
}

// ─── AI detection panel ──────────────────────────────────────────────

function verdictStyles(verdict: string) {
  switch (verdict) {
    case 'almost-certainly-ai':
      return { bg: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-200', bgSoft: 'bg-red-50', label: 'Almost certainly AI-generated' }
    case 'likely-ai':
      return { bg: 'bg-orange-500', text: 'text-orange-700', ring: 'ring-orange-200', bgSoft: 'bg-orange-50', label: 'Likely AI-generated' }
    case 'mixed':
      return { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', bgSoft: 'bg-amber-50', label: 'Mixed / unclear' }
    default:
      return { bg: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-200', bgSoft: 'bg-green-50', label: 'Likely human-authored' }
  }
}

function strengthPill(s: AiSignalStrength) {
  if (s === 'strong') return 'bg-red-100 text-red-700 border-red-200'
  if (s === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function AiDetectionPanel({
  detection,
  hiddenFromBuyers,
}: {
  detection: NonNullable<Report['aiDetection']>
  hiddenFromBuyers: boolean
}) {
  const v = verdictStyles(detection.verdict)
  const signals = detection.signals || []
  const strongSignals = signals.filter((s: AiSignal) => s.strength === 'strong')
  const mediumSignals = signals.filter((s: AiSignal) => s.strength === 'medium')
  const weakSignals = signals.filter((s: AiSignal) => s.strength === 'weak')

  return (
    <div className="border-t border-gray-100 pt-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-(--brand-primary)" />
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">
            AI-Generated Code Detection
          </h3>
        </div>
        {hiddenFromBuyers && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5">
            <EyeOff className="h-3 w-3" /> Hidden from buyers
          </span>
        )}
      </div>

      {/* Verdict tile */}
      <div className={`flex items-center gap-4 p-4 ${v.bgSoft} border border-gray-100`}>
        <div
          className={`flex h-16 w-16 items-center justify-center text-xl font-black text-white ${v.bg} ring-4 ${v.ring}`}
        >
          {detection.probability}%
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${v.text}`}>{v.label}</p>
          <p className="text-xs text-(--color-text-muted) mt-1">
            {detection.totalMatches.toLocaleString()} AI-style pattern{detection.totalMatches === 1 ? '' : 's'} found
            across {detection.locScanned.toLocaleString()} LOC scanned.
          </p>
          <p className="text-[11px] text-(--color-text-muted) mt-1 italic">
            100% local pattern analysis — no API, no AI services. Evidence shown below.
          </p>
        </div>
      </div>

      {/* No signals at all */}
      {signals.length === 0 && (
        <p className="text-xs text-(--color-text-muted) mt-3">
          No AI-style patterns were detected in this codebase.
        </p>
      )}

      {/* Signal list */}
      {signals.length > 0 && (
        <div className="mt-4 space-y-4">
          {strongSignals.length > 0 && (
            <SignalGroup title="Strong tells" signals={strongSignals} />
          )}
          {mediumSignals.length > 0 && (
            <SignalGroup title="Medium tells" signals={mediumSignals} />
          )}
          {weakSignals.length > 0 && (
            <SignalGroup title="Weak tells" signals={weakSignals} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Phase 2 panels ──────────────────────────────────────────────────

function DuplicationPanel({ duplication }: { duplication: NonNullable<Report['duplication']> }) {
  const pct = (duplication.ratio * 100).toFixed(1)
  const tone =
    duplication.ratio > 0.15 ? 'text-red-700'
    : duplication.ratio > 0.08 ? 'text-orange-700'
    : duplication.ratio > 0.03 ? 'text-amber-700'
    : 'text-green-700'

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-(--color-text-muted)" />
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">
            Code Duplication
          </h3>
        </div>
        <span className={`text-sm font-bold ${tone}`}>{pct}% duplicated</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-sm">
        <DetailRow label="Lines scanned" value={duplication.linesScanned.toLocaleString()} />
        <DetailRow label="Duplicated lines" value={duplication.duplicatedLines.toLocaleString()} />
        <DetailRow label="Clone blocks" value={duplication.topBlocks.length.toString()} />
        <DetailRow label="Window size" value="6 lines" />
      </div>

      {duplication.topBlocks.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {duplication.topBlocks.slice(0, 8).map((block) => (
            <div key={`${block.occurrences[0].file}:${block.occurrences[0].line}`} className="border border-gray-100 bg-gray-50/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">
                  {block.lines}-line block · appears {block.occurrences.length} times
                </span>
              </div>
              <p className="text-xs font-mono text-gray-600 break-all">
                <span className="text-gray-400">&gt;</span> {block.snippet}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {block.occurrences.slice(0, 4).map((occ) => (
                  <p key={`${occ.file}:${occ.line}`} className="text-[11px] text-(--color-text-muted) font-mono truncate">
                    {occ.file}:{occ.line}
                  </p>
                ))}
                {block.occurrences.length > 4 && (
                  <p className="text-[11px] text-(--color-text-muted) italic">
                    + {block.occurrences.length - 4} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ComplexityPanel({ complexity }: { complexity: NonNullable<Report['complexity']> }) {
  const tone =
    complexity.maxComplexity > 40 ? 'text-red-700'
    : complexity.maxComplexity > 25 ? 'text-orange-700'
    : complexity.maxComplexity > 15 ? 'text-amber-700'
    : 'text-green-700'

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-(--color-text-muted)" />
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">
            Cyclomatic Complexity
          </h3>
        </div>
        <span className={`text-sm font-bold ${tone}`}>max {complexity.maxComplexity}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-sm">
        <DetailRow label="Functions" value={complexity.totalFunctions.toLocaleString()} />
        <DetailRow label="Avg complexity" value={complexity.avgComplexity.toString()} />
        <DetailRow label="Peak complexity" value={complexity.maxComplexity.toString()} />
        <DetailRow label="Complex (≥11)" value={complexity.complexFunctionCount.toString()} />
      </div>

      {complexity.topOffenders.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {complexity.topOffenders.slice(0, 8).map((fn) => {
            const cls =
              fn.complexity >= 25 ? 'bg-red-100 text-red-700 border-red-200'
              : fn.complexity >= 11 ? 'bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
            return (
              <div key={`${fn.file}:${fn.line}:${fn.name}`} className="flex items-start gap-3 border border-gray-100 bg-gray-50/50 p-3">
                <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                  {fn.complexity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gray-800 truncate">{fn.name}()</p>
                  <p className="text-[11px] text-(--color-text-muted) font-mono truncate">
                    {fn.file}:{fn.line} · {fn.loc} LOC
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-(--color-text-muted) italic mt-2">
        Heuristic count of branches (if/for/while/case/catch/&&/||/?:). Not a full AST parse.
      </p>
    </div>
  )
}

function TestCoveragePanel({ test }: { test: NonNullable<Report['testCoverage']> }) {
  const hasTests = test.testFiles > 0
  const ratioPct = (test.ratio * 100).toFixed(0)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-(--color-text-muted)" />
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">
            Test Coverage Signal
          </h3>
        </div>
        <span className={`text-sm font-bold ${hasTests ? 'text-green-700' : 'text-gray-500'}`}>
          {hasTests ? `${ratioPct}% test-to-source LOC` : 'No tests detected'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-sm">
        <DetailRow label="Test files" value={test.testFiles.toString()} />
        <DetailRow label="Test LOC" value={test.testLoc.toLocaleString()} />
        <DetailRow label="Source files" value={test.sourceFiles.toString()} />
        <DetailRow label="Source LOC" value={test.sourceLoc.toLocaleString()} />
      </div>

      {test.frameworks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {test.frameworks.map((fw) => (
            <span key={fw} className="inline-flex items-center bg-green-50 border border-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {fw}
            </span>
          ))}
        </div>
      )}
      {!hasTests && (
        <p className="text-[11px] text-(--color-text-muted) italic mt-2">
          Scanned for files in <code className="bg-white px-1">/test/</code>, <code className="bg-white px-1">/tests/</code>, <code className="bg-white px-1">/__tests__/</code>, <code className="bg-white px-1">/specs/</code>, and *.test.* / *.spec.* / *_test.go / *Test.java patterns.
        </p>
      )}
    </div>
  )
}

// ─── Phase 3 panel ──────────────────────────────────────────────────

function cveSeverityClasses(sev: VulnerabilityRow['severity']): string {
  if (sev === 'critical') return 'bg-red-100 text-red-700 border-red-200'
  if (sev === 'high') return 'bg-orange-100 text-orange-700 border-orange-200'
  if (sev === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (sev === 'low') return 'bg-sky-100 text-sky-700 border-sky-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function CveScanPanel({ scan }: { scan: NonNullable<Report['cveScan']> }) {
  const hasVulns = scan.vulnerabilities.length > 0
  const tone = hasVulns ? 'text-red-700' : 'text-green-700'

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-(--color-text-muted)" />
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider">
            Dependency Vulnerabilities
          </h3>
        </div>
        <span className={`text-sm font-bold ${tone}`}>
          {hasVulns
            ? `${scan.vulnerableDeps} vulnerable ${scan.vulnerableDeps === 1 ? 'dep' : 'deps'}`
            : 'No known CVEs'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 text-sm">
        <DetailRow label="Deps scanned" value={scan.scanned.toString()} />
        <DetailRow label="Vulnerable deps" value={scan.vulnerableDeps.toString()} />
        <DetailRow label="Advisories" value={scan.vulnerabilities.length.toString()} />
        <DetailRow label="Source" value="OSV.dev" />
      </div>

      {hasVulns && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {scan.vulnerabilities.slice(0, 10).map((v) => (
            <div key={`${v.packageName}:${v.id}`} className="border border-gray-100 bg-gray-50/50 p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cveSeverityClasses(v.severity)}`}>
                    {v.severity}
                  </span>
                  <span className="text-xs font-mono text-gray-700 truncate">
                    {v.packageName}{v.version ? `@${v.version}` : ''}
                  </span>
                </div>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[11px] font-mono text-(--brand-primary) hover:underline inline-flex items-center gap-1"
                >
                  {v.id} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-sm text-gray-800">{v.summary}</p>
            </div>
          ))}
          {scan.vulnerabilities.length > 10 && (
            <p className="text-xs text-(--color-text-muted) text-center pt-2">
              + {scan.vulnerabilities.length - 10} more advisories
            </p>
          )}
        </div>
      )}

      {scan.note && (
        <p className="text-[11px] text-amber-700 italic mt-2">{scan.note}</p>
      )}
      <p className="text-[11px] text-(--color-text-muted) italic mt-2">
        Queried Google&apos;s free OSV.dev advisory database. Dev-only deps are skipped.
      </p>
    </div>
  )
}

function SignalGroup({ title, signals }: { title: string; signals: AiSignal[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-(--color-text-muted) mb-2">{title}</p>
      <div className="space-y-2">
        {signals.map((s) => (
          <div key={s.kind} className="border border-gray-100 bg-gray-50/50 p-3">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${strengthPill(s.strength)}`}>
                  {s.strength}
                </span>
                <span className="text-xs font-mono text-gray-700 truncate">{s.kind}</span>
              </div>
              <span className="text-xs font-bold text-gray-900 shrink-0">×{s.matches}</span>
            </div>
            <p className="text-sm text-gray-800">{s.description}</p>
            {s.exampleFile && (
              <div className="mt-2 border-l-2 border-gray-200 pl-2">
                <p className="text-[11px] text-(--color-text-muted) font-mono truncate">
                  {s.exampleFile}{s.exampleLine ? `:${s.exampleLine}` : ''}
                </p>
                {s.exampleSnippet && (
                  <p className="text-xs font-mono text-gray-600 mt-0.5 break-all">
                    <span className="text-gray-400">&gt;</span> {s.exampleSnippet}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
