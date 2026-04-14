'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  Download,
  Key,
  Code2,
  Loader2,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
interface OrderDetails {
  orderId: string
  productTitle: string
  productSlug: string
  licenseKey: string
  licenseType: string
  amountCents: number
}

// Wrapper with Suspense boundary — required because useSearchParams
// needs a Suspense boundary during static generation.
export default function CheckoutSuccessWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-(--color-background) text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-(--brand-primary)" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch order details using the Stripe session ID
  useEffect(() => {
    async function loadOrder() {
      if (!sessionId) {
        setError('No session ID provided')
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/orders/by-session?session_id=${sessionId}`)
        if (!res.ok) {
          // The webhook might not have processed yet — wait and retry
          await new Promise(resolve => setTimeout(resolve, 2000))
          const retryRes = await fetch(`/api/orders/by-session?session_id=${sessionId}`)
          if (!retryRes.ok) throw new Error('Order not found yet')
          const retryResult = await retryRes.json()
          setOrder(retryResult.data)
        } else {
          const result = await res.json()
          setOrder(result.data)
        }
      } catch {
        setError('Your payment was successful! Your order is being processed — check your purchases page shortly.')
      } finally {
        setIsLoading(false)
      }
    }
    loadOrder()
  }, [sessionId])

  const copyLicenseKey = () => {
    if (!order) return
    navigator.clipboard.writeText(order.licenseKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-(--color-background) text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-(--brand-primary) mx-auto mb-4" />
          <p className="text-(--color-text-secondary)">Processing your order...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-(--color-background) text-white">
      {/* Nav */}
      <nav className="border-b border-(--color-border) bg-(--color-surface)/90 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-(--brand-primary)" />
            <span className="text-xl font-bold">CodeVault</span>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Purchase Complete!</h1>
          <p className="text-(--color-text-secondary)">Thank you for your purchase. Your digital product is ready.</p>
        </div>

        {error && !order && (
          <div className="mb-6 p-4 rounded-none bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm text-center">
            {error}
          </div>
        )}

        {order && (
          <div className="space-y-6">
            {/* Order details card */}
            <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6">
              <h2 className="text-lg font-semibold mb-4">Order Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-(--color-text-secondary)">Product</span>
                  <span className="text-white font-medium">{order.productTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-secondary)">License Type</span>
                  <span className="text-white capitalize">{order.licenseType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-secondary)">Amount Paid</span>
                  <span className="text-white font-medium">${(order.amountCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* License key card */}
            <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Key className="h-5 w-5 text-(--brand-primary)" />
                Your License Key
              </h2>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-3 font-mono text-sm text-(--brand-primary) select-all">
                  {order.licenseKey}
                </code>
                <button
                  onClick={copyLicenseKey}
                  className="p-3 bg-(--color-elevated) border border-(--color-border) rounded-none hover:bg-(--color-elevated) transition-colors"
                  title="Copy license key"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-(--color-text-secondary)" />
                  )}
                </button>
              </div>
              <p className="text-xs text-(--color-text-muted) mt-2">
                Save this key — you'll need it to activate the product. It's also saved in your account.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/dashboard/purchases`}
                className="flex-1 flex items-center justify-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white py-3 rounded-none font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                Go to Downloads
              </Link>
              <Link
                href="/products"
                className="flex-1 flex items-center justify-center gap-2 bg-(--color-elevated) hover:bg-(--color-elevated) border border-(--color-border) text-white py-3 rounded-none font-medium transition-colors"
              >
                Continue Browsing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {!order && !error && (
          <div className="text-center">
            <Link
              href="/dashboard/purchases"
              className="inline-flex items-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white px-6 py-3 rounded-none font-medium transition-colors"
            >
              View Your Purchases
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
