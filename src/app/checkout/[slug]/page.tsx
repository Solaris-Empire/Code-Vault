'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Code2,
  Shield,
  ArrowLeft,
  Loader2,
  Check,
  Star,
  Download,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
interface Product {
  id: string
  title: string
  slug: string
  short_description: string | null
  price_cents: number
  thumbnail_url: string | null
  download_count: number
  avg_rating: number | null
  review_count: number
  seller: { display_name: string } | null
}

type LicenseType = 'regular' | 'extended'

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [licenseType, setLicenseType] = useState<LicenseType>('regular')

  // Fetch product details
  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`/api/products/${slug}`)
        if (!res.ok) throw new Error('Product not found')
        const result = await res.json()
        setProduct(result.data || result)
      } catch {
        setError('Product not found')
      } finally {
        setIsLoading(false)
      }
    }
    loadProduct()
  }, [slug])

  // Calculate price based on license type
  const priceCents = product
    ? licenseType === 'extended'
      ? product.price_cents * 5
      : product.price_cents
    : 0

  const handleCheckout = async () => {
    if (!product) return
    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          license_type: licenseType,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error?.message || 'Checkout failed')
      }

      // Redirect to Stripe Checkout
      if (result.data?.url) {
        window.location.href = result.data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-gray-400 mb-4">This product doesn't exist or is no longer available.</p>
          <Link href="/products" className="text-violet-400 hover:text-violet-300">
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-violet-500" />
            <span className="text-xl font-bold">CodeVault</span>
          </Link>
          <span className="text-sm text-gray-400">Secure Checkout</span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link
          href={`/products/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to product
        </Link>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Product & License Selection */}
          <div className="lg:col-span-3 space-y-6">
            {/* Product summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Product</h2>
              <div className="flex items-start gap-4">
                {product.thumbnail_url ? (
                  <img
                    src={product.thumbnail_url}
                    alt={product.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Code2 className="h-8 w-8 text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{product.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    by {product.seller?.display_name || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                    {product.avg_rating && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                        {Number(product.avg_rating).toFixed(1)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {product.download_count} downloads
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* License type selection */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Choose License</h2>
              <div className="space-y-3">
                {/* Regular License */}
                <button
                  type="button"
                  onClick={() => setLicenseType('regular')}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    licenseType === 'regular'
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {licenseType === 'regular' && (
                          <Check className="h-4 w-4 text-violet-400" />
                        )}
                        <span className="font-medium">Regular License</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Use in a single end product which end users are not charged for
                      </p>
                    </div>
                    <span className="text-lg font-bold text-white">
                      ${(product.price_cents / 100).toFixed(2)}
                    </span>
                  </div>
                </button>

                {/* Extended License */}
                <button
                  type="button"
                  onClick={() => setLicenseType('extended')}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    licenseType === 'extended'
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {licenseType === 'extended' && (
                          <Check className="h-4 w-4 text-violet-400" />
                        )}
                        <span className="font-medium">Extended License</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Use in a single end product which end users can be charged for
                      </p>
                    </div>
                    <span className="text-lg font-bold text-white">
                      ${(product.price_cents * 5 / 100).toFixed(2)}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Order Summary & Pay */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">{product.title}</span>
                  <span className="text-white">${(priceCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">License</span>
                  <span className="text-gray-300 capitalize">{licenseType}</span>
                </div>
                <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
                  <span className="font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-violet-400">
                    ${(priceCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><Shield className="h-4 w-4" /> Pay ${(priceCents / 100).toFixed(2)}</>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Secure payment powered by Stripe. You'll receive instant access after payment.
              </p>

              {/* Trust badges */}
              <div className="mt-6 pt-4 border-t border-gray-800 space-y-2">
                {[
                  'Instant digital delivery',
                  'Lifetime access to updates',
                  'Secure payment via Stripe',
                  '30-day money-back guarantee',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                    <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
