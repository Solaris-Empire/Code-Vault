'use client'

// Post-a-job form. Intentionally tall single-scroll layout — cleaner
// than a wizard for this density. Drives both /jobs/new (create) and
// /jobs/[id]/edit (update) — the difference is one boolean and the
// initial values.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  SKILL_OPTIONS,
  type EmploymentType,
} from '@/lib/jobs/types'

export interface JobFormInitialValues {
  id?: string
  title?: string
  companyName?: string
  companyWebsite?: string | null
  employmentType?: EmploymentType
  location?: string | null
  remote?: boolean
  salaryMinCents?: number | null
  salaryMaxCents?: number | null
  salaryCurrency?: string
  description?: string
  requirements?: string | null
  benefits?: string | null
  skills?: string[]
  applyUrl?: string | null
  applyEmail?: string | null
}

interface Props {
  mode?: 'create' | 'edit'
  initial?: JobFormInitialValues
}

function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toString()
}

export default function PostJobForm({ mode = 'create', initial }: Props = {}) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [company, setCompany] = useState(initial?.companyName ?? '')
  const [website, setWebsite] = useState(initial?.companyWebsite ?? '')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initial?.employmentType ?? 'full_time',
  )
  const [location, setLocation] = useState(initial?.location ?? '')
  const [remote, setRemote] = useState(initial?.remote ?? true)
  const [salaryMin, setSalaryMin] = useState(centsToInput(initial?.salaryMinCents))
  const [salaryMax, setSalaryMax] = useState(centsToInput(initial?.salaryMaxCents))
  const [currency, setCurrency] = useState(initial?.salaryCurrency ?? 'USD')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [requirements, setRequirements] = useState(initial?.requirements ?? '')
  const [benefits, setBenefits] = useState(initial?.benefits ?? '')
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? [])
  const [applyUrl, setApplyUrl] = useState(initial?.applyUrl ?? '')
  const [applyEmail, setApplyEmail] = useState(initial?.applyEmail ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editingId: string | null =
    mode === 'edit' && initial?.id ? initial.id : null

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill].slice(0, 20),
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (description.length < 50) {
      setError('Description must be at least 50 characters.')
      return
    }
    if (!applyUrl.trim() && !applyEmail.trim()) {
      setError('Provide an apply URL or apply email so candidates can reach you.')
      return
    }

    setSubmitting(true)
    try {
      const body = {
        title: title.trim(),
        companyName: company.trim(),
        companyWebsite: website.trim() || null,
        employmentType,
        location: location.trim() || null,
        remote,
        salaryMinCents: salaryMin ? Math.round(parseFloat(salaryMin) * 100) : null,
        salaryMaxCents: salaryMax ? Math.round(parseFloat(salaryMax) * 100) : null,
        salaryCurrency: currency.toUpperCase(),
        description: description.trim(),
        requirements: requirements.trim() || null,
        benefits: benefits.trim() || null,
        skills,
        applyUrl: applyUrl.trim() || null,
        applyEmail: applyEmail.trim() || null,
      }

      const url = editingId ? `/api/jobs/${editingId}` : '/api/jobs'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Failed to save job')
        setSubmitting(false)
        return
      }
      router.push(`/jobs/${editingId ?? json.data.id}`)
      router.refresh()
    } catch {
      setError('Network error. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FieldGroup title="Role basics">
        <Field label="Job title *">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Senior Next.js Engineer"
            className={inputCls}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company *">
            <input
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
              placeholder="Acme Inc."
              className={inputCls}
            />
          </Field>
          <Field label="Company website">
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Employment type">
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              className={inputCls}
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Berlin, DE — or leave blank"
              className={inputCls}
            />
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
          />
          Remote-friendly
        </label>
      </FieldGroup>

      <FieldGroup title="Compensation (optional)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Min">
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="60000"
              className={inputCls}
            />
          </Field>
          <Field label="Max">
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="90000"
              className={inputCls}
            />
          </Field>
          <Field label="Currency">
            <input
              type="text"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className={inputCls}
            />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Details">
        <Field label={`Description * (${description.length}/10000)`}>
          <textarea
            required
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            placeholder="What your team does, what you're building, what this person will own…"
            className={inputCls}
          />
        </Field>
        <Field label="Requirements">
          <textarea
            rows={4}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            maxLength={5000}
            placeholder="Must-haves — years of experience, frameworks, track record…"
            className={inputCls}
          />
        </Field>
        <Field label="Benefits">
          <textarea
            rows={3}
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            maxLength={3000}
            placeholder="Equity, PTO, hardware stipend…"
            className={inputCls}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Skills">
        <p className="text-xs text-(--color-text-muted) mb-2">
          Pick up to 20. Candidates can filter by these.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_OPTIONS.map((skill) => {
            const selected = skills.includes(skill)
            return (
              <button
                type="button"
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                  selected
                    ? 'bg-(--brand-primary) text-white border-(--brand-primary)'
                    : 'bg-(--color-elevated) text-(--color-text-secondary) border-(--color-border) hover:border-(--brand-primary)'
                }`}
              >
                {skill}
              </button>
            )
          })}
        </div>
      </FieldGroup>

      <FieldGroup title="How to apply">
        <p className="text-xs text-(--color-text-muted) mb-2">
          Provide at least one. Candidates can always apply with their
          CodeVault profile in-app — this is for external flows.
        </p>
        <Field label="Apply URL">
          <input
            type="url"
            value={applyUrl}
            onChange={(e) => setApplyUrl(e.target.value)}
            placeholder="https://jobs.acme.com/senior-eng"
            className={inputCls}
          />
        </Field>
        <Field label="Apply email">
          <input
            type="email"
            value={applyEmail}
            onChange={(e) => setApplyEmail(e.target.value)}
            placeholder="hiring@acme.com"
            className={inputCls}
          />
        </Field>
      </FieldGroup>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-600 text-sm p-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {editingId ? 'Save changes' : 'Publish job'}
        </button>
      </div>
    </form>
  )
}

const inputCls =
  'w-full bg-(--color-surface) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)'

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-(--color-border) bg-(--color-surface) p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-(--color-text-secondary)">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
