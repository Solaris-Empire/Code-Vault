'use client'

// Create Service form — Vibe or Real, fixed or hourly pricing.
// Posts to /api/services which enforces the tier gate for Real.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Gem, ArrowLeft, Loader2, DollarSign, Clock, Info, AlertCircle } from 'lucide-react'
import type { SellerTier } from '@/lib/seller/tier'
import { PLATFORM_FEE_PERCENT, computeFixedSplit, computeHourlySplit } from '@/lib/services/pricing'

interface Category { id: string; name: string; icon: string | null }

interface Props {
  sellerTier: SellerTier
  categories: Category[]
}

export default function NewServiceForm({ sellerTier, categories }: Props) {
  const router = useRouter()
  const canListReal = sellerTier === 'pro' || sellerTier === 'elite'

  const [tier, setTier] = useState<'vibe' | 'real'>('vibe')
  const [title, setTitle] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [tagsInput, setTagsInput] = useState('')
  const [pricingModel, setPricingModel] = useState<'fixed' | 'hourly'>('fixed')
  const [priceDollars, setPriceDollars] = useState('')
  const [hourlyRateDollars, setHourlyRateDollars] = useState('')
  const [minHours, setMinHours] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('7')
  const [revisionsIncluded, setRevisionsIncluded] = useState('1')
  const [submitForReview, setSubmitForReview] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceCents = Math.round(parseFloat(priceDollars || '0') * 100)
  const hourlyRateCents = Math.round(parseFloat(hourlyRateDollars || '0') * 100)

  const breakdown =
    pricingModel === 'hourly'
      ? computeHourlySplit(hourlyRateCents, parseInt(minHours || '1', 10) || 1)
      : computeFixedSplit(priceCents)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (tier === 'real' && !canListReal) {
      setError('Real Coder listings require Pro or Elite tier.')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    setSubmitting(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          title: title.trim(),
          shortDescription: shortDescription.trim() || null,
          description: description.trim(),
          categoryId: categoryId || null,
          tags,
          pricingModel,
          priceCents,
          hourlyRateCents: pricingModel === 'hourly' ? hourlyRateCents : null,
          minHours: pricingModel === 'hourly' ? parseInt(minHours || '1', 10) : null,
          deliveryDays: parseInt(deliveryDays, 10),
          revisionsIncluded: parseInt(revisionsIncluded, 10),
          submitForReview,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Failed to create service')
        setSubmitting(false)
        return
      }
      router.push('/seller/services')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/seller/services" className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to services
      </Link>

      <h1 className="text-2xl font-bold mb-1">Create a new service</h1>
      <p className="text-(--color-text-secondary) mb-8">
        Define what you'll deliver, your turnaround, and your price. We'll hold buyer payments in escrow
        and release them to you on delivery.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tier selector */}
        <div>
          <label className="block text-sm font-semibold mb-2">Service tier</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TierCard
              icon={Zap}
              title="Vibe Coder"
              subtitle="Fixed-scope gigs"
              blurb="Clear deliverable, fixed price, fast turnaround. Open to every seller."
              active={tier === 'vibe'}
              onClick={() => setTier('vibe')}
            />
            <TierCard
              icon={Gem}
              title="Real Coder"
              subtitle="Vetted engagements"
              blurb={canListReal
                ? 'Hourly or long-form project work for Pro/Elite sellers.'
                : 'Unlocks at Pro tier. Keep shipping to qualify.'}
              active={tier === 'real'}
              disabled={!canListReal}
              onClick={() => canListReal && setTier('real')}
            />
          </div>
        </div>

        {/* Title / short / description */}
        <Field label="Title" hint="What you'll do. Shown as the gig headline.">
          <input
            type="text"
            required
            minLength={8}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="I will build you a Next.js landing page in 48 hours"
            className={inputCls}
          />
        </Field>

        <Field label="Short description" hint="One-line pitch shown on browse cards (optional).">
          <input
            type="text"
            maxLength={200}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Pixel-perfect landing page, Tailwind + Framer Motion, fully responsive."
            className={inputCls}
          />
        </Field>

        <Field label="Full description" hint="Explain your process, deliverables, what you need from the buyer, and anything that's out of scope. Supports plain text.">
          <textarea
            required
            minLength={40}
            maxLength={10_000}
            rows={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </Field>

        {/* Category + tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">— Pick one —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}{c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags" hint="Comma-separated (max 10).">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="nextjs, tailwind, landing-page"
              className={inputCls}
            />
          </Field>
        </div>

        {/* Pricing */}
        <div>
          <label className="block text-sm font-semibold mb-2">Pricing model</label>
          <div className="grid grid-cols-2 gap-3">
            <PricingToggle
              icon={DollarSign}
              label="Fixed price"
              blurb="One flat fee per order."
              active={pricingModel === 'fixed'}
              onClick={() => setPricingModel('fixed')}
            />
            <PricingToggle
              icon={Clock}
              label="Hourly"
              blurb="Best for Real Coder engagements."
              active={pricingModel === 'hourly'}
              onClick={() => setPricingModel('hourly')}
              disabled={tier === 'vibe'}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pricingModel === 'fixed' ? (
            <Field label="Price (USD)">
              <input
                type="number"
                required min={5} max={50000} step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className={inputCls}
              />
            </Field>
          ) : (
            <>
              <Field label="Hourly rate (USD)">
                <input
                  type="number"
                  required min={5} max={5000} step="0.01"
                  value={hourlyRateDollars}
                  onChange={(e) => setHourlyRateDollars(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Minimum hours">
                <input
                  type="number"
                  required min={1} max={400}
                  value={minHours}
                  onChange={(e) => setMinHours(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Starter price (USD)" hint="Same as rate × min hours; shown on cards.">
                <input
                  type="number"
                  required min={5} step="0.01"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          <Field label="Delivery days">
            <input
              type="number"
              required min={1} max={365}
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Revisions included">
            <input
              type="number"
              required min={0} max={10}
              value={revisionsIncluded}
              onChange={(e) => setRevisionsIncluded(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Fee breakdown */}
        {breakdown.amountCents > 0 && (
          <div className="border border-(--color-border) bg-(--color-surface) p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-(--color-text-secondary)" />
              <span className="text-sm font-semibold">Earnings preview</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="Buyer pays" value={`$${(breakdown.amountCents / 100).toFixed(2)}`} />
              <Stat label={`Platform fee (${PLATFORM_FEE_PERCENT}%)`} value={`−$${(breakdown.platformFeeCents / 100).toFixed(2)}`} />
              <Stat label="You keep" value={`$${(breakdown.sellerPayoutCents / 100).toFixed(2)}`} strong />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="border-t border-(--color-border) pt-5 flex items-center justify-between flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={submitForReview}
              onChange={(e) => setSubmitForReview(e.target.checked)}
            />
            Submit for review now
          </label>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-white px-6 py-2.5 rounded-none text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitForReview ? 'Submit for review' : 'Save as draft'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls =
  'w-full bg-(--color-surface) border border-(--color-border) rounded-none px-3 py-2.5 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) focus:outline-none focus:border-(--brand-primary)'

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-(--color-text-muted) mt-1">{hint}</p>}
    </div>
  )
}

function TierCard({
  icon: Icon, title, subtitle, blurb, active, disabled, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  blurb: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left border p-4 transition-colors ${
        disabled ? 'border-(--color-border) bg-(--color-surface) opacity-50 cursor-not-allowed' :
        active ? 'border-(--brand-primary) bg-(--brand-primary)/10' :
        'border-(--color-border) bg-(--color-surface) hover:border-(--brand-primary)/40'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-5 w-5 ${active ? 'text-(--brand-primary)' : 'text-(--color-text-muted)'}`} />
        <span className="font-semibold">{title}</span>
        {disabled && <span className="text-[10px] uppercase tracking-wider text-(--color-text-muted) font-semibold">Locked</span>}
      </div>
      <p className="text-xs text-(--color-text-muted) mb-1">{subtitle}</p>
      <p className="text-xs text-(--color-text-secondary)">{blurb}</p>
    </button>
  )
}

function PricingToggle({
  icon: Icon, label, blurb, active, disabled, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  blurb: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left border p-3 ${
        disabled ? 'opacity-50 cursor-not-allowed border-(--color-border)' :
        active ? 'border-(--brand-primary) bg-(--brand-primary)/10' :
        'border-(--color-border) bg-(--color-surface) hover:border-(--brand-primary)/40'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-xs text-(--color-text-muted) mt-0.5">{blurb}</p>
    </button>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">{label}</p>
      <p className={`font-mono ${strong ? 'text-(--brand-primary) text-lg font-bold' : 'text-(--color-text-primary)'}`}>{value}</p>
    </div>
  )
}
