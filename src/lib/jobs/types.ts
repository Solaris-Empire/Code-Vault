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

// Human-readable salary range string, null when nothing set.
export function formatSalaryRange(
  minCents: number | null,
  maxCents: number | null,
  currency: string,
): string | null {
  if (minCents === null && maxCents === null) return null
  const fmt = (c: number) => {
    const n = c / 100
    return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
  }
  if (minCents !== null && maxCents !== null) {
    return `${currency} ${fmt(minCents)}–${fmt(maxCents)}`
  }
  if (minCents !== null) return `${currency} from ${fmt(minCents)}`
  return `${currency} up to ${fmt(maxCents!)}`
}
