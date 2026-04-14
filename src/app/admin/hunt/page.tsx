'use client'

// Admin /admin/hunt — on-demand GitHub theft hunt.
// Paste a filename, distinctive token, or raw GitHub search qualifier
// and see confidence-scored matches. Used to manually triage listings.

import { useState } from 'react'
import { Search, Loader2, Dna, ExternalLink, Star, Calendar, ScrollText, GitFork } from 'lucide-react'
import type { GithubMatchResult, GithubMatchRow } from '@/lib/analysis/github-match'

const EXAMPLES: Array<{ label: string; q: string }> = [
  { label: 'Filename', q: 'filename:useAuth.ts' },
  { label: 'Package name', q: '"my-awesome-starter" in:file filename:package.json' },
  { label: 'README title', q: '"# Flux Capacitor" in:file filename:README.md' },
  { label: 'Folder path', q: 'path:src/features/flux-capacitor' },
  { label: 'Unique code token', q: '"const MAGIC_TOKEN = 0xdeadbeef" in:file' },
]

export default function AdminHuntPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GithubMatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim().length < 3) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/hunt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Hunt failed.')
      } else {
        setResult(json.data as GithubMatchResult)
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-1">
        <Dna className="h-5 w-5 text-(--brand-primary)" />
        <h1 className="text-2xl font-bold">Theft Hunt</h1>
      </div>
      <p className="text-sm text-(--color-text-muted) mb-6">
        Ad-hoc GitHub code search with confidence scoring. Use it to triage a listing you suspect is repackaged.
      </p>

      {/* Examples */}
      <div className="mb-5 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.q}
            type="button"
            onClick={() => setQuery(ex.q)}
            className="text-xs border border-(--color-border) bg-(--color-surface) hover:bg-(--color-elevated) px-2.5 py-1 font-mono text-(--color-text-secondary)"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-text-muted)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. filename:package.json "my-awesome-starter"'
            className="w-full bg-(--color-surface) border border-(--color-border) rounded-none pl-10 pr-4 py-3 text-sm font-mono text-(--color-text-primary) placeholder-(--color-text-muted) focus:outline-none focus:border-(--brand-primary)"
          />
        </div>
        <button
          type="submit"
          disabled={loading || query.trim().length < 3}
          className="btn-primary text-white px-6 py-3 rounded-none text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Hunt
        </button>
      </form>

      {error && (
        <div className="border border-red-400/40 bg-red-400/10 text-red-400 px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {result && <HuntResults result={result} />}
    </div>
  )
}

function HuntResults({ result }: { result: GithubMatchResult }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-(--color-text-muted)">
          {result.matches.length} match{result.matches.length === 1 ? '' : 'es'} · {result.queriesRun} quer{result.queriesRun === 1 ? 'y' : 'ies'} run
        </p>
        {result.topConfidence > 0 && (
          <span className={`inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold ${confCls(result.topConfidence)}`}>
            Top: {result.topConfidence}% confidence
          </span>
        )}
      </div>

      {result.note && (
        <p className="text-xs text-amber-400 italic mb-4">{result.note}</p>
      )}

      {result.matches.length === 0 ? (
        <div className="border border-(--color-border) bg-(--color-surface) px-4 py-10 text-center text-sm text-(--color-text-muted)">
          No matches. The query returned zero hits — either nothing upstream or the query needs more specificity.
        </div>
      ) : (
        <div className="space-y-3">
          {result.matches.map((r) => <HuntRow key={r.repoFullName} row={r} />)}
        </div>
      )}
    </div>
  )
}

function HuntRow({ row }: { row: GithubMatchRow }) {
  const ageYears = row.meta.createdAt
    ? Math.floor((Date.now() - new Date(row.meta.createdAt).getTime()) / (365 * 86_400_000))
    : null

  return (
    <div className="border border-(--color-border) bg-(--color-surface) p-4">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <a
            href={row.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono font-semibold text-(--color-text-primary) hover:text-(--brand-primary) inline-flex items-center gap-1.5 break-all"
          >
            {row.repoFullName}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          {row.meta.description && (
            <p className="text-xs text-(--color-text-muted) mt-0.5 line-clamp-2">{row.meta.description}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center border px-2 py-0.5 text-xs font-bold ${confCls(row.confidence)}`}>
          {row.confidence}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-(--color-text-muted) font-mono mt-2">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 text-amber-400" />
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
          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
            <GitFork className="h-3 w-3" />
            {row.matchScore} queries
          </span>
        )}
      </div>
    </div>
  )
}

function confCls(confidence: number): string {
  if (confidence >= 70) return 'bg-red-400/10 text-red-400 border-red-400/30'
  if (confidence >= 40) return 'bg-amber-400/10 text-amber-400 border-amber-400/30'
  if (confidence >= 20) return 'bg-sky-400/10 text-sky-400 border-sky-400/30'
  return 'bg-gray-400/10 text-(--color-text-muted) border-(--color-border)'
}
