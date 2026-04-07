import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  Download,
  FileCode,
  Star,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Seller Dashboard' }

// Revalidate every 30 seconds so seller sees near-real-time stats
export const revalidate = 30

export default async function SellerDashboardPage() {
  // Auth check — redirect to login if not authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/seller/dashboard')
  }

  const admin = getSupabaseAdmin()

  // Check if user is a seller or admin
  const { data: profile } = await admin
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    redirect('/register?role=seller')
  }

  // Fetch seller's products with counts by status
  const { data: products } = await admin
    .from('products')
    .select('id, title, slug, status, price_cents, download_count, avg_rating, review_count, thumbnail_url, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const allProducts = products || []

  // Calculate stats
  const approved = allProducts.filter(p => p.status === 'approved')
  const pending = allProducts.filter(p => p.status === 'pending')
  const drafts = allProducts.filter(p => p.status === 'draft')
  const rejected = allProducts.filter(p => p.status === 'rejected')

  // Fetch total sales (completed orders for this seller's products)
  const productIds = allProducts.map(p => p.id)
  let totalSalesCents = 0
  let totalOrders = 0

  if (productIds.length > 0) {
    const { data: orders } = await admin
      .from('orders')
      .select('seller_payout_cents')
      .in('product_id', productIds)
      .eq('status', 'completed')

    if (orders) {
      totalOrders = orders.length
      totalSalesCents = orders.reduce((sum, o) => sum + (o.seller_payout_cents || 0), 0)
    }
  }

  const totalDownloads = allProducts.reduce((sum, p) => sum + (p.download_count || 0), 0)

  // Status icon and color helper
  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
    approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
    pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    draft: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-400/10' },
    rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.display_name || 'Seller'}</h1>
          <p className="text-gray-400 mt-1">Manage your products and track your sales</p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Upload Product
        </Link>
      </div>

      {/* Stats grid — 4 key metrics at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Earnings', value: `$${(totalSalesCents / 100).toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Total Sales', value: totalOrders.toString(), icon: FileCode, color: 'text-violet-400' },
          { label: 'Total Downloads', value: totalDownloads.toString(), icon: Download, color: 'text-blue-400' },
          { label: 'Products', value: allProducts.length.toString(), icon: Star, color: 'text-yellow-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <span className="text-2xl font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Quick status summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Approved', count: approved.length, status: 'approved' },
          { label: 'Pending Review', count: pending.length, status: 'pending' },
          { label: 'Drafts', count: drafts.length, status: 'draft' },
          { label: 'Rejected', count: rejected.length, status: 'rejected' },
        ].map((item) => {
          const config = statusConfig[item.status]
          const Icon = config.icon
          return (
            <div key={item.status} className={`${config.bg} border border-gray-800 rounded-lg p-4 flex items-center gap-3`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
              <div>
                <span className="text-lg font-bold">{item.count}</span>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Products table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Your Products</h2>
          <Link href="/seller/products/new" className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1">
            Add New <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {allProducts.length === 0 ? (
          <div className="p-12 text-center">
            <FileCode className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-gray-500 mb-4">Upload your first product to start selling on CodeVault</p>
            <Link
              href="/seller/products/new"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Upload Product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Product</th>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Price</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Downloads</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Rating</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {allProducts.map((product) => {
                  const config = statusConfig[product.status] || statusConfig.draft
                  const Icon = config.icon
                  return (
                    <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.thumbnail_url ? (
                            <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center">
                              <FileCode className="h-5 w-5 text-gray-600" />
                            </div>
                          )}
                          <span className="font-medium text-white line-clamp-1">{product.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-300">
                        ${(product.price_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-400">
                        {product.download_count || 0}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-400">
                        {product.avg_rating ? `${Number(product.avg_rating).toFixed(1)} (${product.review_count})` : '-'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/seller/products/${product.id}/edit`}
                          className="text-violet-400 hover:text-violet-300 text-xs font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
