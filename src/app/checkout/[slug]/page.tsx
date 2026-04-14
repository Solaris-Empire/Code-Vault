'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Code2,
  Shield,
  ArrowLeft,
  Loader2,
  Check,
  Star,
  Download,
  X,
} from 'lucide-react'
import {
  LICENSE_TIERS,
  DEFAULT_LICENSE_TIER,
  resolveAllLicensePrices,
  type LicenseTier,
} from '@/lib/constants/licensing'

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
  license_prices_cents: Partial<Record<LicenseTier, number>> | null
  seller: { display_name: string } | null
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function CheckoutPage() {
  const params = useParams()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [licenseType, setLicenseType] = useState<LicenseTier>(DEFAULT_LICENSE_TIER)

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

  const prices = product
    ? resolveAllLicensePrices(product.price_cents, product.license_prices_cents)
    : { personal: 0, commercial: 0, extended: 0 }
  const priceCents = prices[licenseType]

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
      if (!res.ok) throw new Error(result.error?.message || 'Checkout failed')

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
      <div className="min-h-screen bg-(--color-background) flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-(--brand-primary)" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-(--color-background) flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-(--color-text-primary)">Product Not Found</h1>
          <p className="text-(--color-text-secondary) mb-4">This product doesn&apos;t exist or is no longer available.</p>
          <Link href="/products" className="text-(--brand-primary) hover:underline">
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-(--color-background) text-(--color-text-primary)">
      {/* Nav */}
      <nav className="border-b border-(--color-border) bg-(--color-surface) sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-(--brand-primary)" />
            <span className="text-xl font-bold">CodeVault</span>
          </Link>
          <span className="text-sm text-(--color-text-secondary) flex items-center gap-1.5">
            <Shield className="h-4 w-4" /> Secure Checkout
          </span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link
          href={`/products/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to product
        </Link>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: product + tier picker */}
          <div className="lg:col-span-3 space-y-6">
            {/* Product summary */}
            <div className="bg-(--color-surface) border border-(--color-border) p-6">
              <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-4">Your purchase</h2>
              <div className="flex items-start gap-4">
                {product.thumbnail_url ? (
                  <Image
                    src={product.thumbnail_url}
                    alt={product.title}
                    width={80}
                    height={80}
                    className="w-20 h-20 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-(--color-elevated) flex items-center justify-center">
                    <Code2 className="h-8 w-8 text-(--color-text-muted)" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-(--color-text-primary)">{product.title}</h3>
                  <p className="text-(--color-text-secondary) text-sm mt-1">
                    by {product.seller?.display_name || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-(--color-text-secondary)">
                    {product.avg_rating && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-(--brand-amber) text-(--brand-amber)" />
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

            {/* 3-tier license selector */}
            <div className="bg-(--color-surface) border border-(--color-border) p-6">
              <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-1">Choose a license</h2>
              <p className="text-xs text-(--color-text-secondary) mb-5">Pick the tier that matches how you&apos;ll use this code.</p>

              <div className="space-y-3">
                {LICENSE_TIERS.map((tier) => {
                  const active = licenseType === tier.id
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setLicenseType(tier.id)}
                      className={`w-full text-left p-5 border transition-colors ${
                        active
                          ? 'border-(--brand-primary) bg-(--brand-primary)/5'
                          : 'border-(--color-border) bg-(--color-surface) hover:border-(--brand-primary)/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 border flex items-center justify-center shrink-0 ${active ? 'bg-(--brand-primary) border-(--brand-primary)' : 'border-(--color-border)'}`}>
                              {active && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className="font-semibold text-(--color-text-primary)">{tier.name}</span>
                            {tier.id === 'commercial' && (
                              <span className="text-[10px] font-semibold tracking-wider uppercase bg-(--brand-amber) text-white px-1.5 py-0.5">Popular</span>
                            )}
                          </div>
                          <p className="text-sm text-(--color-text-secondary) mt-1 ml-6">{tier.tagline}</p>

                          {active && (
                            <div className="mt-4 ml-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                              {tier.allows.map((a) => (
                                <div key={a} className="flex items-start gap-1.5 text-xs text-(--color-text-secondary)">
                                  <Check className="h-3.5 w-3.5 text-(--brand-primary) shrink-0 mt-0.5" />
                                  <span>{a}</span>
                                </div>
                              ))}
                              {tier.restrictions.map((r) => (
                                <div key={r} className="flex items-start gap-1.5 text-xs text-(--color-text-muted)">
                                  <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                  <span>{r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-(--color-text-primary)">
                            {formatPrice(prices[tier.id])}
                          </div>
                          {tier.priceMultiplier > 1 && (
                            <div className="text-[10px] text-(--color-text-muted) uppercase tracking-wider">{tier.priceMultiplier}x base</div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: summary + pay */}
          <div className="lg:col-span-2">
            <div className="bg-(--color-surface) border border-(--color-border) p-6 lg:sticky lg:top-24">
              <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-4">Order summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-(--color-text-secondary) truncate pr-2">{product.title}</span>
                  <span className="text-(--color-text-primary) font-medium whitespace-nowrap">{formatPrice(priceCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-(--color-text-secondary)">License</span>
                  <span className="text-(--color-text-primary) capitalize">{licenseType}</span>
                </div>
                <div className="border-t border-(--color-border) pt-3 flex items-center justify-between">
                  <span className="font-semibold text-(--color-text-primary)">Total</span>
                  <span className="text-2xl font-bold text-(--brand-primary)">{formatPrice(priceCents)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white py-3 font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><Shield className="h-4 w-4" /> Pay {formatPrice(priceCents)}</>
                )}
              </button>

              <p className="text-xs text-(--color-text-muted) text-center mt-4">
                Secure payment via Stripe. Instant access after payment.
              </p>

              <div className="mt-6 pt-4 border-t border-(--color-border) space-y-2">
                {[
                  'Instant digital delivery',
                  'Free lifetime updates',
                  'Unique license key',
                  '30-day money-back guarantee',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-(--color-text-secondary)">
                    <Check className="h-3.5 w-3.5 text-(--brand-primary) shrink-0" />
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
