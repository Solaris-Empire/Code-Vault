// Seller's services dashboard — list all gigs (vibe + real).

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Briefcase, Clock, CheckCircle, XCircle, AlertCircle, ArrowRight, Zap, Gem } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import type { SellerTier } from '@/lib/seller/tier'
import type { SellerServiceRow } from '@/lib/services/types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Services | CodeVault' }
export const revalidate = 0

export default async function SellerServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/seller/services')

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('users')
    .select('role, seller_tier, display_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    redirect('/register?role=seller')
  }
  const tier = (profile.seller_tier ?? 'unverified') as SellerTier
  const canListReal = tier === 'pro' || tier === 'elite'

  const { data: services } = await admin
    .from('seller_services')
    .select('id, title, slug, tier, status, price_cents, pricing_model, hourly_rate_cents, delivery_days, order_count, avg_rating, review_count, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const all = (services || []) as SellerServiceRow[]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">My Services</h1>
            <SellerTierBadge tier={tier} />
          </div>
          <p className="text-(--color-text-secondary) mt-1">
            Offer services directly to buyers — Vibe Coder gigs or, once you hit Pro, Real Coder engagements.
          </p>
        </div>
        <Link
          href="/seller/services/new"
          className="inline-flex items-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white px-5 py-2.5 rounded-none font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Service
        </Link>
      </div>

      {/* Tier gate callout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <TierCallout
          icon={Zap}
          title="Vibe Coder"
          subtitle="Fixed-scope gigs (Fiverr-style)"
          blurb="Open to every seller. Define a clear deliverable, fixed price, and turnaround time."
          unlocked
        />
        <TierCallout
          icon={Gem}
          title="Real Coder"
          subtitle="Vetted engagements (Toptal-style)"
          blurb={canListReal
            ? 'You are cleared to list Real Coder engagements. Charge hourly or by project.'
            : 'Unlocks at Pro tier. Keep shipping high-quality products and closing sales.'}
          unlocked={canListReal}
        />
      </div>

      {/* Services list */}
      <div className="bg-(--color-surface) border border-(--color-border) rounded-none overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-(--color-border)">
          <h2 className="text-lg font-semibold">Your Services</h2>
          <Link href="/seller/services/new" className="text-(--brand-primary) text-sm flex items-center gap-1">
            Add New <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {all.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No services yet</h3>
            <p className="text-(--color-text-muted) mb-4">Create your first gig to start earning beyond product sales.</p>
            <Link
              href="/seller/services/new"
              className="inline-flex items-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white px-5 py-2.5 rounded-none font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Service
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-(--color-elevated)">
                <tr>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Service</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Tier</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Price</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Delivery</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {all.map((s) => (
                  <tr key={s.id} className="hover:bg-(--color-elevated)/30">
                    <td className="px-5 py-3">
                      <Link href={`/hire/${s.slug}`} className="font-medium text-(--color-text-primary) hover:text-(--brand-primary)">
                        {s.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <TierPill tier={s.tier} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {s.pricing_model === 'hourly'
                        ? `$${((s.hourly_rate_cents || 0) / 100).toFixed(0)}/hr`
                        : `$${(s.price_cents / 100).toFixed(2)}`}
                    </td>
                    <td className="px-5 py-3 text-right text-(--color-text-secondary)">
                      {s.delivery_days}d
                    </td>
                    <td className="px-5 py-3 text-right text-(--color-text-secondary)">
                      {s.order_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function TierCallout({
  icon: Icon, title, subtitle, blurb, unlocked,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  blurb: string
  unlocked: boolean
}) {
  return (
    <div
      className={`border p-5 ${
        unlocked
          ? 'border-(--brand-primary)/40 bg-(--brand-primary)/5'
          : 'border-(--color-border) bg-(--color-surface)'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-5 w-5 ${unlocked ? 'text-(--brand-primary)' : 'text-(--color-text-muted)'}`} />
        <h3 className="font-semibold">{title}</h3>
        {!unlocked && <span className="text-[10px] uppercase tracking-wider text-(--color-text-muted) font-semibold">Locked</span>}
      </div>
      <p className="text-xs text-(--color-text-muted) mb-2">{subtitle}</p>
      <p className="text-sm text-(--color-text-secondary)">{blurb}</p>
    </div>
  )
}

function TierPill({ tier }: { tier: 'vibe' | 'real' }) {
  if (tier === 'real') {
    return (
      <span className="inline-flex items-center gap-1 border border-purple-400/40 bg-purple-400/10 text-purple-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
        <Gem className="h-3 w-3" /> Real
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 border border-amber-400/40 bg-amber-400/10 text-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
      <Zap className="h-3 w-3" /> Vibe
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; Icon: React.ComponentType<{ className?: string }>; label: string }> = {
    approved: { cls: 'bg-green-400/10 text-green-400 border-green-400/30', Icon: CheckCircle, label: 'Approved' },
    pending: { cls: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30', Icon: Clock, label: 'Pending' },
    draft: { cls: 'bg-gray-400/10 text-(--color-text-muted) border-(--color-border)', Icon: AlertCircle, label: 'Draft' },
    paused: { cls: 'bg-sky-400/10 text-sky-400 border-sky-400/30', Icon: Clock, label: 'Paused' },
    rejected: { cls: 'bg-red-400/10 text-red-400 border-red-400/30', Icon: XCircle, label: 'Rejected' },
  }
  const cfg = map[status] || map.draft
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`}>
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}
