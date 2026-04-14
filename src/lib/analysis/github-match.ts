// GitHub public-repo match — did someone repackage a popular open-source
// project? Sprint 2.3 "Deep theft radar" version.
//
// We now run up to 8 targeted queries per upload:
//   1. package.json name
//   2. composer.json name
//   3. README h1 title
//   4. Distinctive root filename
//   5. Distinctive folder path
//   6. Composite query (project name + filename)
//   7. python requirements top package
//   8. Ruby gem name
//
// Each match is enriched with repo creation/push dates, stars, default
// branch, license, and owner so we can compute a confidence score that
// weighs star count, multi-query spread, and repo tenure.
//
// Uses an optional GITHUB_TOKEN env var for 30 req/min vs 10 unauth.
// All failures are non-fatal — we degrade gracefully and write a `note`.
//
// Endpoint docs: https://docs.github.com/en/rest/search/search#search-code

import type { DependencyInfo } from './types'
import type { ContributingFile } from './fingerprint'

const GITHUB_SEARCH_URL = 'https://api.github.com/search/code'
const GITHUB_REPO_URL = 'https://api.github.com/repos/'
const FETCH_TIMEOUT_MS = 8000
const MAX_QUERIES = 8
const TOP_MATCH_REPOS = 8

export interface GithubRepoMeta {
  stars: number
  createdAt: string | null
  pushedAt: string | null
  defaultBranch: string | null
  license: string | null
  description: string | null
  ownerLogin: string | null
}

export interface GithubMatchRow {
  repoFullName: string
  repoUrl: string
  matchedQuery: string
  matchedQueries: string[]
  stars: number
  /** 1–N: how many distinct queries pointed at this repo. */
  matchScore: number
  /** 0–100 confidence this product was copied from this repo. */
  confidence: number
  meta: GithubRepoMeta
}

export interface GithubMatchResult {
  queriesRun: number
  matches: GithubMatchRow[]
  /** Highest confidence number across all matches (0–100). */
  topConfidence: number
  note?: string
}

/** Extra hints collected by the ownership pipeline while walking the ZIP. */
export interface GithubMatchHints {
  readmeTitle?: string | null
  /** e.g. "src/features/flux-capacitor". Something you wouldn't see in a blank template. */
  distinctiveFolderPath?: string | null
}

interface GithubSearchResp {
  items?: Array<{
    repository?: { full_name?: string; html_url?: string; stargazers_count?: number }
  }>
}

interface GithubRepoResp {
  stargazers_count?: number
  created_at?: string
  pushed_at?: string
  default_branch?: string
  description?: string
  license?: { spdx_id?: string | null; name?: string | null } | null
  owner?: { login?: string }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'CodeVault-Analyzer',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// ─── Query building ────────────────────────────────────────────────

interface BuiltQuery {
  q: string
  label: string
}

const GENERIC_BASENAMES = new Set([
  'index.ts', 'index.js', 'index.tsx', 'main.py', 'app.js', 'app.ts',
  'server.js', 'server.ts', 'main.go', 'main.rs', 'App.tsx', 'App.jsx',
  'utils.ts', 'utils.js', 'types.ts', 'config.js', 'config.ts',
])

function buildQueries(
  deps: DependencyInfo[],
  topFiles: ContributingFile[],
  hints: GithubMatchHints,
): BuiltQuery[] {
  const out: BuiltQuery[] = []

  const npmName = deps.find((d) => d.manifest.endsWith('package.json') && !d.dev)?.name
  if (isDistinctiveToken(npmName)) {
    out.push({
      q: `"${npmName}" in:file filename:package.json`,
      label: `package.json name: ${npmName}`,
    })
  }

  const composerName = deps.find((d) => d.manifest.endsWith('composer.json'))?.name
  if (composerName && composerName.includes('/') && composerName.length > 4) {
    out.push({
      q: `"${composerName}" in:file filename:composer.json`,
      label: `composer package: ${composerName}`,
    })
  }

  if (hints.readmeTitle && isDistinctiveToken(hints.readmeTitle)) {
    out.push({
      q: `"# ${hints.readmeTitle}" in:file filename:README.md`,
      label: `README title: ${hints.readmeTitle}`,
    })
  }

  const distinctiveFile = topFiles.find((f) => {
    const base = (f.relPath.split('/').pop() || '').toLowerCase()
    return !GENERIC_BASENAMES.has(base) && base.length >= 6
  })
  if (distinctiveFile) {
    const base = distinctiveFile.relPath.split('/').pop() || ''
    out.push({ q: `filename:${base}`, label: `distinctive filename: ${base}` })

    if (npmName && isDistinctiveToken(npmName)) {
      out.push({
        q: `filename:${base} "${npmName}"`,
        label: `${npmName} + ${base}`,
      })
    }
  }

  if (hints.distinctiveFolderPath && hints.distinctiveFolderPath.length > 8) {
    out.push({
      q: `path:${hints.distinctiveFolderPath}`,
      label: `folder path: ${hints.distinctiveFolderPath}`,
    })
  }

  const pyDep = deps.find((d) => d.manifest.endsWith('requirements.txt'))?.name
  if (isDistinctiveToken(pyDep)) {
    out.push({
      q: `"${pyDep}" in:file filename:requirements.txt`,
      label: `requirements.txt: ${pyDep}`,
    })
  }

  const rubyDep = deps.find((d) => d.manifest.endsWith('Gemfile'))?.name
  if (isDistinctiveToken(rubyDep)) {
    out.push({ q: `"${rubyDep}" in:file filename:Gemfile`, label: `Gemfile: ${rubyDep}` })
  }

  return out.slice(0, MAX_QUERIES)
}

function isDistinctiveToken(s: string | null | undefined): s is string {
  if (!s) return false
  if (s.length < 4) return false
  const lower = s.toLowerCase()
  const banned = new Set([
    'app', 'web', 'site', 'test', 'demo', 'api', 'core', 'common', 'shared',
    'utils', 'template', 'example', 'project', 'starter', 'boilerplate',
  ])
  return !banned.has(lower)
}

// ─── Main entrypoint ───────────────────────────────────────────────

export async function matchAgainstGithub(
  deps: DependencyInfo[],
  topFiles: ContributingFile[],
  hints: GithubMatchHints = {},
): Promise<GithubMatchResult> {
  const queries = buildQueries(deps, topFiles, hints)
  const result: GithubMatchResult = { queriesRun: 0, matches: [], topConfidence: 0 }

  if (queries.length === 0) {
    result.note = 'No distinctive signals to query GitHub with.'
    return result
  }

  const repoCounts = new Map<string, { row: GithubMatchRow; count: number; labels: Set<string> }>()

  for (const q of queries) {
    result.queriesRun++
    const outcome = await runSingleQuery(q)
    if (outcome.stop) {
      result.note = outcome.note
      break
    }
    if (outcome.note) result.note = outcome.note
    for (const item of outcome.items) {
      mergeMatch(repoCounts, item, q.label)
    }
  }

  // Finalize rows, enrich top-N with fresh repo metadata.
  const rows: GithubMatchRow[] = []
  for (const { row, count, labels } of repoCounts.values()) {
    row.matchScore = count
    row.matchedQueries = Array.from(labels)
    rows.push(row)
  }
  rows.sort((a, b) => b.matchScore - a.matchScore || b.stars - a.stars)

  const top = rows.slice(0, TOP_MATCH_REPOS)
  await Promise.all(top.map(enrichRepoMeta))

  for (const r of top) {
    r.confidence = computeConfidence(r)
  }
  top.sort((a, b) => b.confidence - a.confidence)

  result.matches = top
  result.topConfidence = top.length > 0 ? top[0].confidence : 0
  return result
}

interface QueryOutcome {
  items: NonNullable<GithubSearchResp['items']>
  stop: boolean
  note?: string
}

async function runSingleQuery(q: BuiltQuery): Promise<QueryOutcome> {
  const url = `${GITHUB_SEARCH_URL}?q=${encodeURIComponent(q.q)}&per_page=10`
  try {
    const res = await fetchWithTimeout(url, { headers: authHeaders() }, FETCH_TIMEOUT_MS)
    if (res.status === 403 || res.status === 429) {
      return { items: [], stop: true, note: 'GitHub rate limit hit — partial scan.' }
    }
    if (!res.ok) {
      return { items: [], stop: false, note: `GitHub responded ${res.status} — partial scan.` }
    }
    const json = (await res.json()) as GithubSearchResp
    return { items: json.items || [], stop: false }
  } catch {
    return { items: [], stop: false, note: 'GitHub search timed out — partial scan.' }
  }
}

function mergeMatch(
  map: Map<string, { row: GithubMatchRow; count: number; labels: Set<string> }>,
  item: NonNullable<GithubSearchResp['items']>[number],
  queryLabel: string,
): void {
  const full = item.repository?.full_name
  const repoUrl = item.repository?.html_url
  if (!full || !repoUrl) return

  const prev = map.get(full)
  if (prev) {
    prev.count++
    prev.labels.add(queryLabel)
    return
  }
  const stars = item.repository?.stargazers_count ?? 0
  map.set(full, {
    row: {
      repoFullName: full,
      repoUrl,
      matchedQuery: queryLabel,
      matchedQueries: [queryLabel],
      stars,
      matchScore: 1,
      confidence: 0,
      meta: emptyMeta(stars),
    },
    count: 1,
    labels: new Set<string>([queryLabel]),
  })
}

function emptyMeta(stars: number): GithubRepoMeta {
  return {
    stars,
    createdAt: null,
    pushedAt: null,
    defaultBranch: null,
    license: null,
    description: null,
    ownerLogin: null,
  }
}

async function enrichRepoMeta(r: GithubMatchRow): Promise<void> {
  try {
    const res = await fetchWithTimeout(
      GITHUB_REPO_URL + r.repoFullName,
      { headers: authHeaders() },
      FETCH_TIMEOUT_MS,
    )
    if (!res.ok) return
    const data = (await res.json()) as GithubRepoResp
    r.stars = data.stargazers_count ?? r.stars
    r.meta = {
      stars: r.stars,
      createdAt: data.created_at ?? null,
      pushedAt: data.pushed_at ?? null,
      defaultBranch: data.default_branch ?? null,
      license: data.license?.spdx_id ?? data.license?.name ?? null,
      description: data.description ?? null,
      ownerLogin: data.owner?.login ?? null,
    }
  } catch {
    // swallow — meta stays partial
  }
}

// ─── Admin on-demand hunt ──────────────────────────────────────────
// Lets the /admin/hunt tool run ad-hoc GitHub queries (paste filename,
// code snippet, or raw GitHub search qualifier). Reuses the same
// confidence scoring + metadata enrichment as the batch pipeline.

export async function huntGithub(rawQuery: string): Promise<GithubMatchResult> {
  const query = rawQuery.trim()
  const result: GithubMatchResult = { queriesRun: 0, matches: [], topConfidence: 0 }
  if (query.length < 3) {
    result.note = 'Query too short — enter at least 3 characters.'
    return result
  }

  const repoCounts = new Map<string, { row: GithubMatchRow; count: number; labels: Set<string> }>()
  const label = `hunt: ${query.slice(0, 60)}`
  const outcome = await runSingleQuery({ q: query, label })
  result.queriesRun = 1

  if (outcome.note) result.note = outcome.note
  for (const item of outcome.items) mergeMatch(repoCounts, item, label)

  const rows: GithubMatchRow[] = []
  for (const { row, count, labels } of repoCounts.values()) {
    row.matchScore = count
    row.matchedQueries = Array.from(labels)
    rows.push(row)
  }
  rows.sort((a, b) => b.stars - a.stars)

  const top = rows.slice(0, TOP_MATCH_REPOS)
  await Promise.all(top.map(enrichRepoMeta))
  for (const r of top) r.confidence = computeConfidence(r)
  top.sort((a, b) => b.confidence - a.confidence)

  result.matches = top
  result.topConfidence = top.length > 0 ? top[0].confidence : 0
  return result
}

// ─── Confidence scoring ────────────────────────────────────────────

function computeConfidence(r: GithubMatchRow): number {
  let score = 0

  // Multi-query spread: each additional distinct query adds 20 points.
  score += Math.min(r.matchScore, 4) * 20

  // Star weight: famous repos = high-confidence upstream.
  if (r.stars >= 10_000) score += 40
  else if (r.stars >= 1000) score += 30
  else if (r.stars >= 100) score += 20
  else if (r.stars >= 10) score += 10

  // Tenure weight: a repo older than 2 years is a likelier origin than a brand-new fork.
  if (r.meta.createdAt) {
    const ageDays = (Date.now() - new Date(r.meta.createdAt).getTime()) / 86_400_000
    if (ageDays > 730) score += 10
    else if (ageDays > 365) score += 5
  }

  return Math.min(100, score)
}
