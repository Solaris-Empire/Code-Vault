'use client'

// Brief + requirements form. Submits to /api/services/orders which
// redirects the buyer to Stripe Checkout.

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, Loader2, AlertCircle, Clock, RefreshCw, Shield, Gem, Zap,
  User as UserIcon, Info,
} from 'lucide-react'
import { PLATFORM_FEE_PERCENT, computeFixedSplit, computeHourlySplit } from '@/lib/services/pricing'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import type { SellerTier } from '@/lib/seller/tier'
import type { ServiceTier, ServicePricingModel } from '@/lib/services/types'

export interface CheckoutService {
  id: string
  seller_id: string
  tier: ServiceTier
  title: string
  slug: string
  short_description: string | null
  thumbnail_url: string | null
  pricing_model: ServicePricingModel
  price_cents: number
  hourly_rate_cents: number | null
  min_hours: number | null
  delivery_days: number
  revisions_included: number
  status: string
  seller: {
    id: string
    display_name: string | null
    avatar_url: string | null
    seller_tier: string | null
  } | null
}

export default function OrderCheckoutForm({ service }: { service: CheckoutService }) {
  const [brief, setBrief] = useState('')
  const [hours, setHours] = useState<string>(String(service.min_hours ?? 1))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedHours = Math.max(
    service.min_hours ?? 1,
    parseInt(hours || '1', 10) || (service.min_hours ?? 1),
  )

  const breakdown =
    service.pricing_model === 'hourly'
      ? computeHourlySplit(service.hourly_rate_cents || 0, parsedHours)
      : computeFixedSplit(service.price_cents)

  const sellerTier = (service.seller?.seller_tier ?? 'unverified') as SellerTier

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (brief.trim().length < 40) {
      setError('Brief must be at least 40 characters — give the seller enough to start.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/services/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          brief: brief.trim(),
          hours: service.pricing_model === 'hourly' ? parsedHours : null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.data?.url) {
        setError(json.error?.message || 'Failed to start checkout')
        setSubmitting(false)
        return
      }
      window.location.href = json.data.url as string
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="nav-light sticky top-0 z-40 border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={`/hire/${service.slug}`}
            className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-green-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to service
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Hire {service.seller?.display_name || 'this seller'}</h1>
        <p className="text-(--color-text-secondary) mb-8">
          Send the brief. We'll hold your payment in escrow and release it when the work is delivered and accepted.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column — brief */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                {service.tier === 'real' ? (
                  <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-semibold px-2 py-0.5">
                    <Gem className="h-3 w-3" /> Real Coder
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5">
                    <Zap className="h-3 w-3" /> Vibe Coder
                  </span>
                )}
                <h2 className="text-lg font-semibold">{service.title}</h2>
              </div>
              {service.short_description && (
                <p className="text-sm text-(--color-text-secondary)">{service.short_description}</p>
              )}
            </section>

            <section className="bg-white border border-gray-200 p-5">
              <label className="block text-sm font-semibold mb-2">Your brief</label>
              <p className="text-xs text-(--color-text-muted) mb-3">
                Describe what you need, the deliverables, deadlines, and any technical constraints.
                The more specific you are, the faster the seller can start.
              </p>
              <textarea
                required
                minLength={40}
                maxLength={5_000}
                rows={10}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="I need a Next.js 15 landing page with hero, features, pricing, and a contact form. Tailwind for styling. I'll provide copy + logo. Deliver as a GitHub PR against my repo."
                className="w-full bg-white border border-gray-200 rounded-none px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 resize-y"
              />
              <div className="text-xs text-(--color-text-muted) mt-1 flex justify-between">
                <span>At least 40 characters.</span>
                <span>{brief.length} / 5000</span>
              </div>
            </section>

            {service.pricing_model === 'hourly' && (
              <section className="bg-white border border-gray-200 p-5">
                <label className="block text-sm font-semibold mb-2">Estimated hours</label>
                <p className="text-xs text-(--color-text-muted) mb-3">
                  You'll pay for this block up-front. If more time is needed, you can extend with a new order.
                </p>
                <input
                  type="number"
                  required
                  min={service.min_hours ?? 1}
                  max={2000}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200"
                />
                {service.min_hours && (
                  <p className="text-xs text-(--color-text-muted) mt-1">Minimum {service.min_hours} hours.</p>
                )}
              </section>
            )}

            <section className="bg-green-50/40 border border-green-100 p-5 text-sm text-(--color-text-primary)">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold">Escrow protection</h3>
              </div>
              <p className="text-(--color-text-secondary) leading-relaxed">
                Your payment is held by CodeVault until the seller delivers and you accept the work.
                If something goes wrong you can request revisions or open a dispute.
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="bg-white border border-gray-200 p-5 sticky top-20">
              {/* Seller */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="h-12 w-12 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  {service.seller?.avatar_url ? (
                    <Image src={service.seller.avatar_url} alt="" width={48} height={48} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-6 w-6 text-(--color-text-muted)" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 line-clamp-1">{service.seller?.display_name || 'Unknown'}</p>
                  <div className="mt-1"><SellerTierBadge tier={sellerTier} /></div>
                </div>
              </div>

              {/* Terms */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-(--color-text-secondary)">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span>Delivery in <strong className="text-gray-900">{service.delivery_days} days</strong></span>
                </div>
                <div className="flex items-center gap-2 text-(--color-text-secondary)">
                  <RefreshCw className="h-4 w-4 text-green-600" />
                  <span>
                    <strong className="text-gray-900">
                      {service.revisions_included === 0 ? 'No' : service.revisions_included}
                    </strong> revision{service.revisions_included === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span>{service.pricing_model === 'hourly' ? `${parsedHours}h × $${((service.hourly_rate_cents || 0) / 100).toFixed(0)}/hr` : 'Service fee'}</span>
                  <span className="font-mono">${(breakdown.amountCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-(--color-text-muted) text-xs">
                  <span>Platform fee ({PLATFORM_FEE_PERCENT}% — deducted from seller)</span>
                  <span className="font-mono">${(breakdown.platformFeeCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 font-semibold text-gray-900">
                  <span>You pay today</span>
                  <span className="font-mono text-green-600 text-lg">${(breakdown.amountCents / 100).toFixed(2)}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 mt-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary text-white py-3 mt-4 rounded-none font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? 'Starting checkout…' : `Pay $${(breakdown.amountCents / 100).toFixed(2)}`}
              </button>

              <p className="text-[11px] text-(--color-text-muted) text-center mt-2 flex items-center justify-center gap-1">
                <Info className="h-3 w-3" /> Secure checkout via Stripe
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}
