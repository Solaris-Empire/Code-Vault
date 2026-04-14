'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Tag,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Upload,
  Image as ImageIcon,
  FileCode,
  Save,
  Trash2,
} from 'lucide-react'
import {
  TierPricingSection,
  buildLicensePricesCents,
  type TierPriceInput,
} from '@/components/seller/tier-pricing'
import type { LicenseTier } from '@/lib/constants/licensing'

// ─── Types ──────────────────────────────────────────────────────────
interface Category {
  id: string
  name: string
  slug: string
}

interface Product {
  id: string
  title: string
  slug: string
  short_description: string
  description: string
  price_cents: number
  license_prices_cents: Partial<Record<LicenseTier, number>> | null
  category_id: string
  demo_url: string | null
  thumbnail_url: string | null
  tags: string[]
  status: string
  show_ai_detection: boolean | null
  download_count: number
  avg_rating: number | null
  review_count: number
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  // Form state
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [priceDollars, setPriceDollars] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [tags, setTags] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null)
  const [status, setStatus] = useState('draft')
  const [useCustomTierPrices, setUseCustomTierPrices] = useState(false)
  const [customTierPrices, setCustomTierPrices] = useState<TierPriceInput>({})
  const [showAiDetection, setShowAiDetection] = useState(true)

  // Fetch product data and categories on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch categories and product in parallel
        const [catRes, prodRes] = await Promise.all([
          fetch('/api/categories'),
          fetch(`/api/products/${productId}`),
        ])

        const catResult = await catRes.json()
        const cats = catResult.data || catResult
        if (Array.isArray(cats)) setCategories(cats)

        if (!prodRes.ok) {
          setError('Product not found or you do not have access to edit it.')
          setIsLoading(false)
          return
        }

        const prodResult = await prodRes.json()
        const product: Product = prodResult.data || prodResult

        // Populate form fields with existing data
        setTitle(product.title)
        setSlug(product.slug)
        setShortDescription(product.short_description || '')
        setDescription(product.description || '')
        setPriceDollars((product.price_cents / 100).toFixed(2))
        setCategoryId(product.category_id)
        setDemoUrl(product.demo_url || '')
        setTags((product.tags || []).join(', '))
        setCurrentThumbnail(product.thumbnail_url)
        setStatus(product.status)
        setShowAiDetection(product.show_ai_detection ?? true)

        // Prefill tier overrides if seller previously set any
        if (product.license_prices_cents && typeof product.license_prices_cents === 'object') {
          const overrides = product.license_prices_cents
          const toInput: TierPriceInput = {}
          for (const tier of ['personal', 'commercial', 'extended'] as const) {
            const cents = overrides[tier]
            if (typeof cents === 'number' && cents > 0) {
              toInput[tier] = (cents / 100).toFixed(2)
            }
          }
          if (Object.keys(toInput).length > 0) {
            setUseCustomTierPrices(true)
            setCustomTierPrices(toInput)
          }
        }
      } catch {
        setError('Failed to load product data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [productId])

  const handleSubmit = async (e: React.FormEvent, saveAs?: 'draft' | 'pending') => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) return setError('Title is required')
    if (!slug.trim()) return setError('Slug is required')
    if (!priceDollars || parseFloat(priceDollars) < 0) return setError('Valid price is required')
    if (!categoryId) return setError('Please select a category')

    setIsSubmitting(true)

    try {
      // Upload new thumbnail if one was selected
      let thumbnailUrl = currentThumbnail
      if (thumbnailFile) {
        const thumbFormData = new FormData()
        thumbFormData.append('file', thumbnailFile)
        thumbFormData.append('bucket', 'thumbnails')

        const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbFormData })
        if (!thumbRes.ok) throw new Error('Failed to upload thumbnail')
        const thumbData = await thumbRes.json()
        thumbnailUrl = thumbData.url || thumbData.data?.url
      }

      // Update the product
      const priceCents = Math.round(parseFloat(priceDollars) * 100)
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)
      const licensePricesCents = buildLicensePricesCents(useCustomTierPrices, customTierPrices)

      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          short_description: shortDescription.trim(),
          description: description.trim(),
          price_cents: priceCents,
          license_prices_cents: licensePricesCents,
          category_id: categoryId,
          demo_url: demoUrl.trim() || null,
          thumbnail_url: thumbnailUrl,
          tags: tagArray,
          show_ai_detection: showAiDetection,
          ...(saveAs && { status: saveAs }),
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error?.message || 'Failed to update product')
      }

      router.push('/seller/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-(--brand-primary)" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/seller/dashboard" className="text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Product</h1>
          <p className="text-(--color-text-secondary) text-sm mt-1">
            Update your product details. Changes to content will reset status to pending review.
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-(--color-text-muted)">Current status:</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          status === 'approved' ? 'bg-green-400/10 text-green-400' :
          status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' :
          status === 'rejected' ? 'bg-red-400/10 text-red-400' :
          'bg-gray-400/10 text-(--color-text-secondary)'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-none bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form className="space-y-6">
        {/* Basic Info */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-(--brand-primary)" />
            Basic Info
          </h2>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Product Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">URL Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) font-mono text-sm focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Short Description</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={200}
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Full Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none resize-y"
            />
          </div>
        </div>

        {/* Pricing & Category */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            Pricing & Category
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Price (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)">$</span>
                <input
                  type="number"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none pl-7 pr-4 py-2.5 text-(--color-text-primary) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
                  required
                />
              </div>
              <p className="text-xs text-(--color-text-muted) mt-1">
                You earn 85% = ${priceDollars ? (parseFloat(priceDollars) * 0.85).toFixed(2) : '0.00'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5 flex items-center gap-1.5">
              <Tag className="h-4 w-4" /> Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, dashboard, admin (comma-separated)"
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4" /> Demo URL
            </label>
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://demo.example.com"
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
            />
          </div>
        </div>

        {/* License Tier Pricing */}
        <TierPricingSection
          basePriceDollars={priceDollars}
          useCustom={useCustomTierPrices}
          setUseCustom={setUseCustomTierPrices}
          customPrices={customTierPrices}
          setCustomPrices={setCustomTierPrices}
        />

        {/* Code Analysis Visibility */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6 space-y-3">
          <h2 className="text-lg font-semibold">Code Analysis Visibility</h2>
          <p className="text-sm text-(--color-text-muted)">
            The full quality report is always public. You can choose whether
            the AI-code-detection section shows on your product page.
          </p>
          <label className="flex items-start gap-3 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={showAiDetection}
              onChange={(e) => setShowAiDetection(e.target.checked)}
              className="mt-1 h-4 w-4 accent-green-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">
                Show AI-detection result on the public product page
              </p>
              <p className="text-xs text-(--color-text-muted) mt-0.5">
                You and admins always see the AI analysis on the product page.
              </p>
            </div>
          </label>
        </div>

        {/* Thumbnail */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            Thumbnail
          </h2>

          {/* Show current thumbnail if exists */}
          {currentThumbnail && !thumbnailFile && (
            <div className="flex items-center gap-4">
              <img
                src={currentThumbnail}
                alt="Current thumbnail"
                className="w-20 h-20 rounded-none object-cover border border-(--color-border)"
              />
              <span className="text-sm text-(--color-text-secondary)">Current thumbnail</span>
            </div>
          )}

          <label className="flex items-center gap-3 bg-(--color-elevated) border border-(--color-border) border-dashed rounded-none p-4 cursor-pointer hover:border-(--brand-primary) transition-colors">
            <ImageIcon className="h-8 w-8 text-(--color-text-muted)" />
            <div className="flex-1">
              {thumbnailFile ? (
                <span className="text-sm text-(--color-text-primary)">{thumbnailFile.name} (new)</span>
              ) : (
                <span className="text-sm text-(--color-text-muted)">Click to upload a new thumbnail image</span>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>

        {/* Submit buttons */}
        <div className="flex items-center justify-between">
          <Link
            href="/seller/dashboard"
            className="text-(--color-text-muted) hover:text-(--color-text-secondary) text-sm transition-colors"
          >
            Cancel
          </Link>
          <div className="flex items-center gap-3">
            {status !== 'approved' && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'draft')}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-none font-medium text-(--color-text-secondary) bg-(--color-elevated) hover:bg-(--color-elevated) border border-(--color-border) transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
            )}
            <button
              type="button"
              onClick={(e) => handleSubmit(e, status === 'approved' ? undefined : 'pending')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-none font-medium text-(--color-text-primary) bg-(--brand-primary) hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4" /> {status === 'approved' ? 'Save Changes' : 'Submit for Review'}</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
