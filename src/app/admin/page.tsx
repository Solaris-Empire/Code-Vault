'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  Package,
  DollarSign,
  ShoppingCart,
  Clock,
  Star,
  ArrowRight,
  Loader2,
  TrendingUp,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
interface DashboardData {
  overview: {
    totalUsers: number
    totalProducts: number
    pendingProducts: number
    totalOrders: number
    totalRevenue: number
    platformRevenue: number
    thisMonthRevenue: number
    totalReviews: number
  }
  recentProducts: Array<{
    id: string
    title: string
    slug: string
    status: string
    created_at: string
    seller: { display_name: string } | null
  }>
  recentOrders: Array<{
    id: string
    amount_cents: number
    platform_fee_cents: number
    status: string
    created_at: string
    buyer: { display_name: string } | null
    product: { title: string } | null
  }>
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(res => res.json())
      .then(result => setData(result.data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="h-8 w-8 animate-spin text-(--brand-primary)" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-red-400">Failed to load dashboard data.</p>
      </div>
    )
  }

  const stats = [
    { label: 'Total Revenue', value: `$${(data.overview.totalRevenue / 100).toFixed(2)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Platform Fees', value: `$${(data.overview.platformRevenue / 100).toFixed(2)}`, icon: TrendingUp, color: 'text-(--brand-primary)', bg: 'bg-(--brand-primary)/10' },
    { label: 'This Month', value: `$${(data.overview.thisMonthRevenue / 100).toFixed(2)}`, icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Total Orders', value: data.overview.totalOrders.toString(), icon: ShoppingCart, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Total Users', value: data.overview.totalUsers.toString(), icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { label: 'Products', value: data.overview.totalProducts.toString(), icon: Package, color: 'text-pink-400', bg: 'bg-pink-400/10' },
    { label: 'Pending Review', value: data.overview.pendingProducts.toString(), icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Reviews', value: data.overview.totalReviews.toString(), icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-(--color-surface) border border-(--color-border) rounded-none p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-(--color-text-muted)">{stat.label}</span>
              <div className={`p-2 rounded-none ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <span className="text-2xl font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent products */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none">
          <div className="flex items-center justify-between p-5 border-b border-(--color-border)">
            <h2 className="font-semibold">Recent Products</h2>
            <Link href="/admin/products" className="text-(--brand-primary) hover:text-(--brand-primary) text-sm flex items-center gap-1">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {data.recentProducts.map((product) => (
              <div key={product.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">{product.title}</p>
                  <p className="text-xs text-(--color-text-muted)">by {product.seller?.display_name || 'Unknown'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  product.status === 'approved' ? 'bg-green-400/10 text-green-400' :
                  product.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' :
                  product.status === 'rejected' ? 'bg-red-400/10 text-red-400' :
                  'bg-gray-400/10 text-(--color-text-secondary)'
                }`}>
                  {product.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none">
          <div className="flex items-center justify-between p-5 border-b border-(--color-border)">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link href="/admin/orders" className="text-(--brand-primary) hover:text-(--brand-primary) text-sm flex items-center gap-1">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">{order.product?.title || 'Unknown'}</p>
                  <p className="text-xs text-(--color-text-muted)">{order.buyer?.display_name || 'Unknown'}</p>
                </div>
                <span className="text-sm font-medium text-green-400">
                  ${(order.amount_cents / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
