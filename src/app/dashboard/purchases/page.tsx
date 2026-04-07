import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Download,
  Key,
  Package,
  ArrowLeft,
  FileCode,
  ExternalLink,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'My Purchases | CodeVault' }

// Revalidate every 30 seconds so buyer sees recent purchases
export const revalidate = 30

export default async function PurchasesPage() {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/dashboard/purchases')
  }

  const admin = getSupabaseAdmin()

  // Fetch buyer's orders with product and license info
  const { data: orders } = await admin
    .from('orders')
    .select(`
      id, amount_cents, status, created_at,
      product:products(id, title, slug, thumbnail_url, seller_id),
      license:licenses(license_key, license_type)
    `)
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const safeOrders = orders || []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">My Purchases</h1>
            <p className="text-gray-400 text-sm mt-1">
              {safeOrders.length} product{safeOrders.length !== 1 ? 's' : ''} purchased
            </p>
          </div>
        </div>

        {safeOrders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No purchases yet</h2>
            <p className="text-gray-500 mb-6">Browse our marketplace to find your next project.</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {safeOrders.map((order) => {
              const rawProduct = order.product as unknown
              const product = Array.isArray(rawProduct) ? rawProduct[0] as { id: string; title: string; slug: string; thumbnail_url: string | null } | undefined : rawProduct as { id: string; title: string; slug: string; thumbnail_url: string | null } | null
              const rawLicense = order.license as unknown
              const license = Array.isArray(rawLicense) ? rawLicense[0] as { license_key: string; license_type: string } | undefined : rawLicense as { license_key: string; license_type: string } | null

              return (
                <div
                  key={order.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    {product?.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <FileCode className="h-6 w-6 text-gray-600" />
                      </div>
                    )}

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-white">
                            {product?.title || 'Unknown Product'}
                          </h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {license?.license_type === 'extended' ? 'Extended' : 'Regular'} License
                            &middot; ${(order.amount_cents / 100).toFixed(2)}
                            &middot; {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {product && (
                            <Link
                              href={`/api/downloads/${product.id}`}
                              className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Link>
                          )}
                          {product && (
                            <Link
                              href={`/products/${product.slug}`}
                              className="p-2 text-gray-400 hover:text-white transition-colors"
                              title="View product"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* License key */}
                      {license && (
                        <div className="mt-3 flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-gray-500" />
                          <code className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded">
                            {license.license_key}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
