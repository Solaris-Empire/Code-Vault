// Types + constants shared between the jobs API and UI.

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'freelance'

export const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'full_time',  label: 'Full-time' },
  { value: 'part_time',  label: 'Part-time' },
  { value: 'contract',   label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance',  label: 'Freelance' },
]

export type SalaryPeriod = 'hour' | 'day' | 'week' | 'month' | 'year'

export const SALARY_PERIOD_OPTIONS: { value: SalaryPeriod; label: string; short: string }[] = [
  { value: 'hour',  label: 'per hour',  short: '/hr' },
  { value: 'day',   label: 'per day',   short: '/day' },
  { value: 'week',  label: 'per week',  short: '/wk' },
  { value: 'month', label: 'per month', short: '/mo' },
  { value: 'year',  label: 'per year',  short: '/yr' },
]

// Common marketplace currencies — covers 95% of real-world postings.
// Free-text is gone; a dropdown prevents typos like "usd " that fail
// CHAR(3) constraints or break formatting.
export const SALARY_CURRENCY_OPTIONS = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'CHF', 'JPY', 'BRL',
] as const
export type SalaryCurrency = (typeof SALARY_CURRENCY_OPTIONS)[number]

export type ApplicationStatus =
  | 'submitted'
  | 'reviewed'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'withdrawn'

export interface JobListRow {
  id: string
  poster_id: string
  title: string
  company_name: string
  company_website: string | null
  employment_type: EmploymentType
  location: string | null
  remote: boolean
  salary_min_cents: number | null
  salary_max_cents: number | null
  salary_currency: string
  salary_period: SalaryPeriod
  description: string
  skills: string[]
  application_count: number
  created_at: string
  expires_at: string
  poster_name: string | null
  poster_avatar: string | null
}

// Skill suggestions for the post-a-job form.
export const SKILL_OPTIONS = [
  'react', 'nextjs', 'vue', 'svelte', 'angular',
  'typescript', 'javascript', 'python', 'go', 'rust',
  'php', 'laravel', 'wordpress',
  'nodejs', 'bun', 'deno', 'django', 'rails',
  'postgres', 'supabase', 'mysql', 'mongodb', 'redis',
  'tailwind', 'flutter', 'react-native', 'swift', 'kotlin',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'vercel', 'cloudflare',
  'graphql', 'rest-api', 'websockets', 'stripe', 'ai-ml', 'llm', 'devops',
] as const

// For "per hour" / "per day" ranges we keep the raw number ($45/hr),
// otherwise we shorten thousands to "k" to keep cards compact ($80k/yr).
function formatMoney(cents: number, period: SalaryPeriod): string {
  const n = cents / 100
  const useK = period !== 'hour' && period !== 'day' && n >= 1000
  if (useK) {
    const k = n / 1000
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// Human-readable salary range string, null when nothing set.
// Example: "USD 80k–120k /yr" or "USD 45–60 /hr".
export function formatSalaryRange(
  minCents: number | null,
  maxCents: number | null,
  currency: string,
  period: SalaryPeriod = 'year',
): string | null {
  if (minCents === null && maxCents === null) return null
  const suffix = SALARY_PERIOD_OPTIONS.find((o) => o.value === period)?.short ?? ''
  if (minCents !== null && maxCents !== null) {
    return `${currency} ${formatMoney(minCents, period)}–${formatMoney(maxCents, period)} ${suffix}`.trim()
  }
  if (minCents !== null) return `${currency} from ${formatMoney(minCents, period)} ${suffix}`.trim()
  return `${currency} up to ${formatMoney(maxCents!, period)} ${suffix}`.trim()
}
