'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  Search,
  FileCode,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
interface Product {
  id: string
  title: string
  slug: string
  status: string
  price_cents: number
  download_count: number
  created_at: string
  thumbnail_url: string | null
  seller: { display_name: string } | null
  category: { name: string } | null
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'draft'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch products
  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/admin/products?${params}`)
      const result = await res.json()
      setProducts(result.data || [])
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [statusFilter])

  // Approve or reject a product
  const handleStatusChange = async (productId: string, newStatus: 'approved' | 'rejected') => {
    setActionLoading(productId)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        // Remove from list or update status
        setProducts(prev =>
          prev.map(p => p.id === productId ? { ...p, status: newStatus } : p)
        )
      }
    } catch {
      // Silent fail
    } finally {
      setActionLoading(null)
    }
  }

  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
    approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
    pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    draft: { icon: AlertCircle, color: 'text-(--color-text-secondary)', bg: 'bg-gray-400/10' },
    rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  }

  const filterTabs: { value: StatusFilter; label: string }[] = [
    { value: 'pending', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'draft', label: 'Drafts' },
    { value: 'all', label: 'All' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Product Management</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-none text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-(--brand-primary) text-white'
                  : 'bg-(--color-elevated) text-(--color-text-secondary) hover:text-(--color-text-primary)'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); fetchProducts() }}
          className="relative flex-1 max-w-xs"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none pl-10 pr-4 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) outline-none"
          />
        </form>
      </div>

      {/* Products table */}
      <div className="bg-(--color-surface) border border-(--color-border) rounded-none overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-(--brand-primary)" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-(--color-text-muted)">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-(--color-elevated)">
                <tr>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Product</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Seller</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Category</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Price</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {products.map((product) => {
                  const config = statusConfig[product.status] || statusConfig.draft
                  const Icon = config.icon
                  const isActioning = actionLoading === product.id

                  return (
                    <tr key={product.id} className="hover:bg-(--color-elevated) transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.thumbnail_url ? (
                            <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-(--color-elevated) flex items-center justify-center">
                              <FileCode className="h-5 w-5 text-(--color-text-muted)" />
                            </div>
                          )}
                          <span className="font-medium text-(--color-text-primary) line-clamp-1">{product.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-(--color-text-secondary)">
                        {product.seller?.display_name || 'Unknown'}
                      </td>
                      <td className="px-5 py-4 text-(--color-text-secondary)">
                        {product.category?.name || '-'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-(--color-text-secondary)">
                        ${(product.price_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            className="p-1.5 text-(--color-text-muted) hover:text-(--color-text-primary) transition-colors"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {product.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(product.id, 'approved')}
                                disabled={isActioning}
                                className="px-3 py-1.5 text-xs font-medium rounded-none bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                              >
                                {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleStatusChange(product.id, 'rejected')}
                                disabled={isActioning}
                                className="px-3 py-1.5 text-xs font-medium rounded-none bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {product.status === 'rejected' && (
                            <button
                              onClick={() => handleStatusChange(product.id, 'approved')}
                              disabled={isActioning}
                              className="px-3 py-1.5 text-xs font-medium rounded-none bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                        </div>
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
