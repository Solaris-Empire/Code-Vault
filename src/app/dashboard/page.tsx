import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Package,
  Download,
  Key,
  ArrowRight,
  ShoppingBag,
  Store,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { BuyerTierBadge, type BuyerTier } from '@/components/buyer/buyer-tier-badge'

import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Dashboard | CodeVault' }

export const revalidate = 30

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/dashboard')
  }

  const admin = getSupabaseAdmin()

  const { data: profile } = await admin
    .from('users')
    .select('display_name, role, avatar_url, created_at, buyer_tier, buyer_purchase_count, buyer_total_spent_cents, is_premium')
    .eq('id', user.id)
    .single()

  const { data: orders } = await admin
    .from('orders')
    .select(`
      id, amount_cents, created_at,
      product:products(id, title, slug, thumbnail_url),
      license:licenses(license_key, license_type)
    `)
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: totalOrders } = await admin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
    .eq('status', 'completed')

  const { count: totalLicenses } = await admin
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', user.id)

  const totalSpentCents = (orders || []).reduce((sum, o) => sum + (o.amount_cents || 0), 0)

  const safeOrders = orders || []
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-(--color-background) text-(--color-text-primary)">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Welcome header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">Welcome back, {displayName}</h1>
              <BuyerTierBadge tier={(profile?.buyer_tier ?? 'explorer') as BuyerTier} size="pill" />
            </div>
            <p className="text-(--color-text-secondary) mt-1">Your purchases, licenses, and downloads in one place.</p>
            {(profile?.buyer_purchase_count ?? 0) > 0 && (
              <p className="text-xs text-(--color-text-muted) mt-2">
                {profile?.buyer_purchase_count} purchases · ${((profile?.buyer_total_spent_cents ?? 0) / 100).toFixed(2)} lifetime
                {profile?.is_premium && ' · Premium active'}
              </p>
            )}
          </div>
          {profile?.role === 'seller' && (
            <Link
              href="/seller/dashboard"
              className="inline-flex items-center gap-2 bg-(--color-surface) border border-(--color-border) hover:border-(--brand-primary) text-(--color-text-primary) px-4 py-2.5 rounded-none font-medium transition-colors"
            >
              <Store className="h-4 w-4" /> Seller Dashboard
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Purchases', value: (totalOrders ?? 0).toString(), icon: ShoppingBag },
            { label: 'Licenses', value: (totalLicenses ?? 0).toString(), icon: Key },
            { label: 'Total Spent', value: `$${(totalSpentCents / 100).toFixed(2)}`, icon: Download },
          ].map((stat) => (
            <div key={stat.label} className="bg-(--color-surface) border border-(--color-border) rounded-none p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-(--color-text-muted)">{stat.label}</span>
                <stat.icon className="h-5 w-5 text-(--brand-primary)" />
              </div>
              <span className="text-2xl font-bold">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Recent purchases */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none">
          <div className="flex items-center justify-between p-5 border-b border-(--color-border)">
            <h2 className="text-lg font-semibold">Recent Purchases</h2>
            <Link href="/dashboard/purchases" className="text-(--brand-primary) hover:opacity-80 text-sm flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {safeOrders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 text-(--color-text-muted) mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No purchases yet</h3>
              <p className="text-(--color-text-muted) mb-4">Browse our marketplace and find your next project.</p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white px-5 py-2.5 rounded-none font-medium transition-colors"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-(--color-border)">
              {safeOrders.map((order) => {
                const product = Array.isArray(order.product) ? order.product[0] : order.product
                const license = Array.isArray(order.license) ? order.license[0] : order.license
                if (!product) return null
                return (
                  <div key={order.id} className="flex items-center gap-4 p-5">
                    {product.thumbnail_url ? (
                      <Image
                        src={product.thumbnail_url}
                        alt={product.title}
                        width={56}
                        height={56}
                        className="w-14 h-14 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-(--color-elevated) flex items-center justify-center">
                        <Package className="h-6 w-6 text-(--color-text-muted)" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{product.title}</h3>
                      <p className="text-xs text-(--color-text-muted) mt-0.5 capitalize">
                        {license?.license_type || 'personal'} license · ${(order.amount_cents / 100).toFixed(2)}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/purchases"
                      className="text-sm text-(--brand-primary) hover:opacity-80 whitespace-nowrap"
                    >
                      Download
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
