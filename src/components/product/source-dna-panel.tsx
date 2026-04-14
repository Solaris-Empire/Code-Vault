// Source DNA panel — Sprint 2.3 "Deep theft radar".
// Pure presentation. Shows top public-repo matches from the GitHub code
// search with confidence %, stars, repo age, license, and matched queries.

import { Dna, ExternalLink, Star, Calendar, ScrollText, GitFork, Eye } from 'lucide-react'
import type { GithubMatchRow } from '@/lib/analysis/github-match'

interface SourceDNAPanelProps {
  matches: GithubMatchRow[] | null
  topConfidence?: number
  note?: string | null
  /** Compact mode shows only the top 2 matches. */
  compact?: boolean
}

export function SourceDNAPanel({ matches, topConfidence = 0, note, compact = false }: SourceDNAPanelProps) {
  const rows = matches || []

  if (rows.length === 0) {
    return (
      <div className="card rounded-none p-6">
        <Header topConfidence={0} />
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <Eye className="h-4 w-4" />
          No public-repo matches found — this code does not appear to be a repackaged GitHub project.
        </div>
        {note && <p className="text-[11px] text-(--color-text-muted) italic mt-2">{note}</p>}
      </div>
    )
  }

  const visible = compact ? rows.slice(0, 2) : rows

  return (
    <div className="card rounded-none p-6">
      <Header topConfidence={topConfidence} />

      <p className="text-xs text-(--color-text-muted) mt-2 mb-4">
        Distinctive signals (README title, package name, folder paths, filenames) were cross-referenced
        against the entire public GitHub. Higher confidence = stronger indication this code originated upstream.
      </p>

      <div className="space-y-3">
        {visible.map((r) => (
          <MatchRow key={r.repoFullName} row={r} />
        ))}
      </div>

      {compact && rows.length > visible.length && (
        <p className="text-xs text-(--color-text-muted) text-center mt-3 italic">
          + {rows.length - visible.length} more matches in full report
        </p>
      )}

      {note && <p className="text-[11px] text-(--color-text-muted) italic mt-4">{note}</p>}
    </div>
  )
}

function Header({ topConfidence }: { topConfidence: number }) {
  const conf = confidenceTone(topConfidence)
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Dna className="h-5 w-5 text-(--brand-primary)" />
        <h2 className="text-xl font-bold">Source DNA</h2>
      </div>
      {topConfidence > 0 && (
        <span className={`inline-flex items-center gap-1 border px-2.5 py-0.5 text-xs font-semibold ${conf.cls}`}>
          Top match: {topConfidence}% confidence
        </span>
      )}
    </div>
  )
}

function MatchRow({ row }: { row: GithubMatchRow }) {
  const conf = confidenceTone(row.confidence)
  const ageYears = row.meta.createdAt
    ? Math.floor((Date.now() - new Date(row.meta.createdAt).getTime()) / (365 * 86_400_000))
    : null

  return (
    <div className="border border-gray-100 bg-gray-50/50 p-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <a
            href={row.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono font-semibold text-gray-900 hover:text-(--brand-primary) inline-flex items-center gap-1.5 break-all"
          >
            {row.repoFullName}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          {row.meta.description && (
            <p className="text-xs text-(--color-text-muted) mt-0.5 line-clamp-2">{row.meta.description}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center border px-2 py-0.5 text-xs font-bold ${conf.cls}`}>
          {row.confidence}%
        </span>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-(--color-text-muted) font-mono mt-2">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 text-amber-500" />
          {row.stars.toLocaleString()} stars
        </span>
        {ageYears !== null && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {ageYears === 0 ? '<1y old' : `${ageYears}y old`}
          </span>
        )}
        {row.meta.license && (
          <span className="inline-flex items-center gap-1">
            <ScrollText className="h-3 w-3" />
            {row.meta.license}
          </span>
        )}
        {row.matchScore > 1 && (
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <GitFork className="h-3 w-3" />
            {row.matchScore} queries matched
          </span>
        )}
      </div>

      {/* Matched queries */}
      {row.matchedQueries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.matchedQueries.map((q) => (
            <span
              key={q}
              className="inline-flex items-center bg-white border border-gray-200 px-2 py-0.5 text-[10px] font-mono text-gray-700"
            >
              {q}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function confidenceTone(confidence: number): { cls: string } {
  if (confidence >= 70) return { cls: 'bg-red-50 text-red-700 border-red-200' }
  if (confidence >= 40) return { cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (confidence >= 20) return { cls: 'bg-sky-50 text-sky-700 border-sky-200' }
  return { cls: 'bg-gray-50 text-gray-600 border-gray-200' }
}
