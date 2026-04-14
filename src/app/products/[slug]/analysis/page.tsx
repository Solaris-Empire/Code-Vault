// Public, full-depth static analysis report for a product.
// This is the "SonarQube-style" expanded view linked from the compact
// CodeQualityReport card on the product detail page.
//
// Server component — renders everything from the pre-computed
// public.product_analyses.report JSONB, no fetching from third parties here.

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Copy,
  GitBranch,
  FlaskConical,
  ExternalLink,
  FileCode,
  Package,
  Languages,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { Report, Issue } from '@/lib/analysis/types'
import type { VulnerabilityRow } from '@/lib/analysis/cve'
import { OwnershipPanel, type OwnershipRow } from '@/components/product/ownership-panel'
import { SourceDNAPanel } from '@/components/product/source-dna-panel'
import type { GithubMatchRow } from '@/lib/analysis/github-match'

export const revalidate = 60

interface AnalysisPageProps {
  params: Promise<{ slug: string }>
}

interface ProductSummary {
  id: string
  title: string
  slug: string
}

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

export async function generateMetadata({ params }: AnalysisPageProps): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Code quality report — ${slug} | CodeVault`,
    description: `Full static-analysis report for ${slug}.`,
    robots: { index: true, follow: true },
  }
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A': return { bg: 'bg-green-500', ring: 'ring-green-200', text: 'text-green-700' }
    case 'B': return { bg: 'bg-lime-500', ring: 'ring-lime-200', text: 'text-lime-700' }
    case 'C': return { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700' }
    case 'D': return { bg: 'bg-orange-500', ring: 'ring-orange-200', text: 'text-orange-700' }
    default: return { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' }
  }
}

function severityBadge(sev: Issue['severity']) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider'
  switch (sev) {
    case 'critical': return { cls: `${base} bg-red-100 text-red-700`, Icon: ShieldAlert }
    case 'major': return { cls: `${base} bg-orange-100 text-orange-700`, Icon: AlertTriangle }
    case 'minor': return { cls: `${base} bg-amber-100 text-amber-700`, Icon: AlertCircle }
    default: return { cls: `${base} bg-gray-100 text-gray-600`, Icon: Info }
  }
}

function cveSeverityCls(sev: VulnerabilityRow['severity']): string {
  if (sev === 'critical') return 'bg-red-100 text-red-700 border-red-200'
  if (sev === 'high') return 'bg-orange-100 text-orange-700 border-orange-200'
  if (sev === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (sev === 'low') return 'bg-sky-100 text-sky-700 border-sky-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
  })
}

export default async function ProductAnalysisPage({ params }: AnalysisPageProps) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data: product } = await supabase
    .from('products')
    .select('id, title, slug')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  if (!product) notFound()
  const typedProduct = product as ProductSummary

  const { data: row } = await supabase
    .from('product_analyses')
    .select('status, error_message, quality_score, grade, total_loc, total_files, dependency_count, issue_count, report, updated_at')
    .eq('product_id', typedProduct.id)
    .maybeSingle()

  const analysis = row as AnalysisRow | null

  const { data: ownershipRow } = await supabase
    .from('product_ownership_checks')
    .select('verdict, authenticity_score, license_name, license_classification, license_allows_resale, git_present, git_unique_authors, git_matches_seller, copyright_holders_count, obfuscated_file_count, fingerprint_matches, github_match_count, signals, details, updated_at')
    .eq('product_id', typedProduct.id)
    .maybeSingle()
  const ownership: (OwnershipRow & { details?: { githubMatches?: GithubMatchRow[]; githubNote?: string } }) | null = ownershipRow
  const githubMatches: GithubMatchRow[] = ownership?.details?.githubMatches || []

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
            <Link href="/" className="hover:text-green-600 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-green-600 transition-colors">Products</Link>
            <span>/</span>
            <Link href={`/products/${typedProduct.slug}`} className="hover:text-green-600 transition-colors truncate max-w-[200px]">
              {typedProduct.title}
            </Link>
            <span>/</span>
            <span className="text-gray-700">Analysis</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/products/${typedProduct.slug}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-green-600 transition-colors"
        >
          <ArrowLeft size={16} /> Back to product
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-5 w-5 text-(--brand-primary)" />
            <p className="text-sm font-semibold text-(--brand-primary) uppercase tracking-wider">
              Full Code Quality Report
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{typedProduct.title}</h1>
          {analysis && (
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Generated {formatDate(analysis.updated_at)}
            </p>
          )}
        </header>

        {ownership && (
          <div className="mb-8">
            <OwnershipPanel ownership={ownership} expanded />
          </div>
        )}

        {ownership && (
          <div className="mb-8">
            <SourceDNAPanel
              matches={githubMatches}
              topConfidence={githubMatches.reduce((max, r) => Math.max(max, r.confidence || 0), 0)}
              note={ownership.details?.githubNote}
            />
          </div>
        )}

        {!analysis && <NoAnalysisState />}
        {analysis?.status === 'pending' && <PendingState />}
        {analysis?.status === 'failed' && <FailedState message={analysis.error_message} />}
        {analysis?.status === 'completed' && (
          <CompletedReport analysis={analysis} />
        )}
      </div>
    </main>
  )
}

function NoAnalysisState() {
  return (
    <div className="card rounded-none p-8 text-center">
      <p className="text-gray-700">No static analysis has been run for this product yet.</p>
    </div>
  )
}

function PendingState() {
  return (
    <div className="card rounded-none p-8 text-center">
      <p className="text-gray-700">Analysis is still in progress. Refresh in a moment.</p>
    </div>
  )
}

function FailedState({ message }: { message: string | null }) {
  return (
    <div className="card rounded-none p-8">
      <p className="text-red-700 font-semibold">Analysis failed</p>
      <p className="text-sm text-(--color-text-muted) mt-2">{message || 'Unknown error'}</p>
    </div>
  )
}

function CompletedReport({ analysis }: { analysis: AnalysisRow }) {
  const report = analysis.report as Report
  const grade = gradeColor(analysis.grade)
  const issues = report.issues || []
  const languages = report.languages || []
  const metrics = report.metrics

  const sevCounts = { critical: 0, major: 0, minor: 0, info: 0 }
  for (const iss of issues) sevCounts[iss.severity]++

  return (
    <>
      {/* Hero: grade + score + price */}
      <section className="card rounded-none p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex items-center gap-5">
            <div className={`flex h-24 w-24 items-center justify-center text-5xl font-black text-white ${grade.bg} ring-4 ${grade.ring}`}>
              {analysis.grade}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">{analysis.quality_score}</span>
                <span className="text-sm text-(--color-text-muted)">/ 100</span>
              </div>
              <p className={`text-sm font-medium ${grade.text} mt-1`}>Quality score</p>
            </div>
          </div>

          <StatBox label="Lines of Code" value={analysis.total_loc.toLocaleString()} Icon={FileCode} />
          <StatBox label="Issues" value={analysis.issue_count.toString()} Icon={AlertCircle} />
        </div>

        {report.suggestedPrice && (
          <div className="mt-6 border-t border-gray-100 pt-5 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-(--brand-primary) mt-1 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider text-(--color-text-secondary) font-semibold">Fair Value Estimate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${report.suggestedPrice.minUsd} – ${report.suggestedPrice.maxUsd}
              </p>
              <p className="text-xs text-(--color-text-muted) mt-1 flex items-start gap-1">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                {report.suggestedPrice.rationale}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Metrics */}
      {metrics && (
        <section className="mb-8">
          <SectionHeader icon={Package} title="Metrics" />
          <div className="card rounded-none p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCell label="Files" value={metrics.totalFiles.toLocaleString()} />
            <MetricCell label="Total LOC" value={metrics.totalLoc.toLocaleString()} />
            <MetricCell label="Blank lines" value={metrics.totalBlankLines.toLocaleString()} />
            <MetricCell label="Comment lines" value={metrics.totalCommentLines.toLocaleString()} />
            <MetricCell label="Comment ratio" value={`${(metrics.commentRatio * 100).toFixed(1)}%`} />
            <MetricCell label="Avg file LOC" value={metrics.avgFileLoc.toString()} />
            <MetricCell label="Largest file" value={`${metrics.maxFileLoc.toLocaleString()} LOC`} />
            <MetricCell label="Max dir depth" value={metrics.maxDirDepth.toString()} />
            <MetricCell label="God files" value={metrics.godFileCount.toString()} />
            <MetricCell label="Binary files" value={metrics.binaryFileCount.toString()} />
            <MetricCell label="Generated files" value={metrics.generatedFileCount.toString()} />
            <MetricCell label="Dependencies" value={analysis.dependency_count.toString()} />
          </div>
        </section>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <section className="mb-8">
          <SectionHeader icon={Languages} title="Language breakdown" />
          <div className="card rounded-none p-6 space-y-3">
            {languages.map((l) => (
              <div key={l.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-800">{l.name}</span>
                  <span className="text-(--color-text-muted)">
                    {l.percent}% · {l.loc.toLocaleString()} LOC · {l.files} files
                  </span>
                </div>
                <div className="h-2 bg-gray-100 overflow-hidden">
                  <div className="h-full bg-(--brand-primary)" style={{ width: `${l.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Duplication */}
      {report.duplication && report.duplication.linesScanned > 0 && (
        <section className="mb-8">
          <SectionHeader icon={Copy} title="Code duplication" />
          <FullDuplication duplication={report.duplication} />
        </section>
      )}

      {/* Complexity */}
      {report.complexity && report.complexity.totalFunctions > 0 && (
        <section className="mb-8">
          <SectionHeader icon={GitBranch} title="Cyclomatic complexity" />
          <FullComplexity complexity={report.complexity} />
        </section>
      )}

      {/* Test coverage */}
      {report.testCoverage && (
        <section className="mb-8">
          <SectionHeader icon={FlaskConical} title="Test coverage signal" />
          <FullTestCoverage test={report.testCoverage} />
        </section>
      )}

      {/* CVE scan */}
      {report.cveScan && (
        <section className="mb-8">
          <SectionHeader icon={ShieldCheck} title="Dependency vulnerabilities (CVEs)" />
          <FullCveScan scan={report.cveScan} />
        </section>
      )}

      {/* All issues */}
      {issues.length > 0 && (
        <section className="mb-8">
          <SectionHeader icon={AlertCircle} title={`All issues (${issues.length})`} />
          <div className="card rounded-none p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {sevCounts.critical > 0 && <SevPill count={sevCounts.critical} label="Critical" cls="bg-red-50 text-red-700 border-red-200" />}
              {sevCounts.major > 0 && <SevPill count={sevCounts.major} label="Major" cls="bg-orange-50 text-orange-700 border-orange-200" />}
              {sevCounts.minor > 0 && <SevPill count={sevCounts.minor} label="Minor" cls="bg-amber-50 text-amber-700 border-amber-200" />}
              {sevCounts.info > 0 && <SevPill count={sevCounts.info} label="Info" cls="bg-gray-50 text-gray-600 border-gray-200" />}
            </div>
            <div className="space-y-2">
              {issues.map((iss, i) => {
                const b = severityBadge(iss.severity)
                return (
                  <div key={i} className="flex items-start gap-3 text-sm border border-gray-100 bg-gray-50/50 p-3">
                    <span className={b.cls}>
                      <b.Icon className="h-3 w-3" />
                      {iss.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 break-words">{iss.message}</p>
                      <p className="text-[11px] font-mono text-(--color-text-muted) mt-0.5">
                        kind: {iss.kind}
                        {iss.file ? ` · ${iss.file}${iss.line ? `:${iss.line}` : ''}` : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <p className="text-xs text-(--color-text-muted) italic">
        Analyzer v{report.analyzerVersion} · generated {formatDate(report.analyzedAt)}.
        All metrics are computed locally by CodeVault&apos;s static analyzer. CVE advisories sourced from
        Google&apos;s OSV.dev database.
      </p>
    </>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-(--brand-primary)" />
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  )
}

function StatBox({ label, value, Icon }: { label: string; value: string; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">{label}</span>
        <Icon className="h-4 w-4 text-(--color-text-muted)" />
      </div>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
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

function FullDuplication({ duplication }: { duplication: NonNullable<Report['duplication']> }) {
  const pct = (duplication.ratio * 100).toFixed(1)
  return (
    <div className="card rounded-none p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCell label="Duplicated" value={`${pct}%`} />
        <MetricCell label="Lines scanned" value={duplication.linesScanned.toLocaleString()} />
        <MetricCell label="Duplicated lines" value={duplication.duplicatedLines.toLocaleString()} />
        <MetricCell label="Clone blocks" value={duplication.topBlocks.length.toString()} />
      </div>
      {duplication.topBlocks.length === 0 ? (
        <p className="text-sm text-(--color-text-muted)">No duplicate blocks detected.</p>
      ) : (
        <div className="space-y-2">
          {duplication.topBlocks.map((block) => (
            <div key={`${block.occurrences[0].file}:${block.occurrences[0].line}`} className="border border-gray-100 bg-gray-50/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">
                  {block.lines}-line block · {block.occurrences.length} occurrences
                </span>
              </div>
              <p className="text-xs font-mono text-gray-600 break-all">
                <span className="text-gray-400">&gt;</span> {block.snippet}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {block.occurrences.map((occ) => (
                  <p key={`${occ.file}:${occ.line}`} className="text-[11px] text-(--color-text-muted) font-mono truncate">
                    {occ.file}:{occ.line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FullComplexity({ complexity }: { complexity: NonNullable<Report['complexity']> }) {
  return (
    <div className="card rounded-none p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCell label="Functions" value={complexity.totalFunctions.toLocaleString()} />
        <MetricCell label="Avg complexity" value={complexity.avgComplexity.toString()} />
        <MetricCell label="Peak complexity" value={complexity.maxComplexity.toString()} />
        <MetricCell label="Complex (≥11)" value={complexity.complexFunctionCount.toString()} />
      </div>
      {complexity.topOffenders.length === 0 ? (
        <p className="text-sm text-(--color-text-muted)">No complex functions detected.</p>
      ) : (
        <div className="space-y-2">
          {complexity.topOffenders.map((fn) => {
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
                  <p className="text-sm font-mono text-gray-800 break-all">{fn.name}()</p>
                  <p className="text-[11px] text-(--color-text-muted) font-mono truncate">
                    {fn.file}:{fn.line} · {fn.loc} LOC
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-(--color-text-muted) italic mt-3">
        Heuristic count of decision points (if/for/while/case/catch/&&/||/?:). Not a full AST parse.
      </p>
    </div>
  )
}

function FullTestCoverage({ test }: { test: NonNullable<Report['testCoverage']> }) {
  const hasTests = test.testFiles > 0
  const ratioPct = (test.ratio * 100).toFixed(0)
  return (
    <div className="card rounded-none p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCell label="Test files" value={test.testFiles.toString()} />
        <MetricCell label="Test LOC" value={test.testLoc.toLocaleString()} />
        <MetricCell label="Source files" value={test.sourceFiles.toString()} />
        <MetricCell label="Source LOC" value={test.sourceLoc.toLocaleString()} />
        <MetricCell label="Test/source ratio" value={hasTests ? `${ratioPct}%` : 'n/a'} />
        <MetricCell label="Frameworks" value={test.frameworks.length.toString()} />
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
        <p className="text-sm text-(--color-text-muted) mt-3">
          No test files detected. Looked for <code className="bg-gray-50 px-1">/test/</code>,{' '}
          <code className="bg-gray-50 px-1">/tests/</code>,{' '}
          <code className="bg-gray-50 px-1">/__tests__/</code>,{' '}
          <code className="bg-gray-50 px-1">/specs/</code>, and <code className="bg-gray-50 px-1">*.test.*</code> / <code className="bg-gray-50 px-1">*.spec.*</code> / <code className="bg-gray-50 px-1">*_test.go</code> / <code className="bg-gray-50 px-1">*Test.java</code>.
        </p>
      )}
    </div>
  )
}

function FullCveScan({ scan }: { scan: NonNullable<Report['cveScan']> }) {
  return (
    <div className="card rounded-none p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCell label="Deps scanned" value={scan.scanned.toString()} />
        <MetricCell label="Vulnerable deps" value={scan.vulnerableDeps.toString()} />
        <MetricCell label="Advisories" value={scan.vulnerabilities.length.toString()} />
        <MetricCell label="Scanned at" value={new Date(scan.scannedAt).toLocaleDateString()} />
      </div>

      {scan.note && (
        <p className="text-sm text-amber-700 italic mb-3">{scan.note}</p>
      )}

      {scan.vulnerabilities.length === 0 ? (
        <p className="text-sm text-green-700 font-medium">
          No known CVEs in the scanned dependencies.
        </p>
      ) : (
        <div className="space-y-2">
          {scan.vulnerabilities.map((v) => (
            <div key={`${v.packageName}:${v.id}`} className="border border-gray-100 bg-gray-50/50 p-3">
              <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cveSeverityCls(v.severity)}`}>
                    {v.severity}
                  </span>
                  <span className="text-xs font-mono text-gray-700 break-all">
                    {v.packageName}{v.version ? `@${v.version}` : ''} · {v.ecosystem}
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
              {v.publishedAt && (
                <p className="text-[11px] text-(--color-text-muted) mt-1">
                  Published {new Date(v.publishedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
