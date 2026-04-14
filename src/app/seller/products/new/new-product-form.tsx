'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  FileCode,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  Tag,
  DollarSign,
  FileText,
  Link as LinkIcon,
} from 'lucide-react'
import {
  TierPricingSection,
  buildLicensePricesCents,
  type TierPriceInput,
} from '@/components/seller/tier-pricing'

// Category type from the API
interface Category {
  id: string
  name: string
  slug: string
}

export default function NewProductForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  // Form state — controlled inputs so we can validate before submit
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [priceDollars, setPriceDollars] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [tags, setTags] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [version, setVersion] = useState('1.0.0')
  const [changelog, setChangelog] = useState('')
  const [useCustomTierPrices, setUseCustomTierPrices] = useState(false)
  const [customTierPrices, setCustomTierPrices] = useState<TierPriceInput>({})
  const [showAiDetection, setShowAiDetection] = useState(true)

  // Fetch categories for the dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(result => {
        const cats = result.data || result
        if (Array.isArray(cats)) setCategories(cats)
      })
      .catch(() => {})
  }, [])

  // Auto-generate slug from title (kebab-case)
  useEffect(() => {
    const generated = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generated)
  }, [title])

  const handleSubmit = async (e: React.FormEvent, saveAs: 'draft' | 'pending') => {
    e.preventDefault()
    setError(null)

    // Basic validation
    if (!title.trim()) return setError('Title is required')
    if (!slug.trim()) return setError('Slug is required')
    if (!priceDollars || parseFloat(priceDollars) < 0) return setError('Valid price is required')
    if (!categoryId) return setError('Please select a category')
    if (!productFile) return setError('Please upload a product file')

    setIsSubmitting(true)

    try {
      // Step 1: Upload thumbnail to Supabase Storage (if provided)
      let thumbnailUrl: string | null = null
      if (thumbnailFile) {
        const thumbFormData = new FormData()
        thumbFormData.append('file', thumbnailFile)
        thumbFormData.append('bucket', 'thumbnails')

        const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbFormData })
        if (!thumbRes.ok) {
          const errData = await thumbRes.json().catch(() => ({}))
          throw new Error(errData.error?.message || `Thumbnail upload failed (${thumbRes.status})`)
        }
        const thumbData = await thumbRes.json()
        thumbnailUrl = thumbData.url || thumbData.data?.url
      }

      // Step 2: Upload product file to Supabase Storage
      const fileFormData = new FormData()
      fileFormData.append('file', productFile)
      fileFormData.append('bucket', 'product-files')

      const fileRes = await fetch('/api/upload', { method: 'POST', body: fileFormData })
      if (!fileRes.ok) {
        const errData = await fileRes.json().catch(() => ({}))
        throw new Error(errData.error?.message || `Product file upload failed (${fileRes.status})`)
      }
      const fileData = await fileRes.json()
      const fileUrl = fileData.url || fileData.data?.url

      // Step 3: Create the product via API
      const priceCents = Math.round(parseFloat(priceDollars) * 100)
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)
      const licensePricesCents = buildLicensePricesCents(useCustomTierPrices, customTierPrices)

      const productRes = await fetch('/api/seller/products', {
        method: 'POST',
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
          status: saveAs,
          show_ai_detection: showAiDetection,
          // File info for creating product_files entry
          file_url: fileUrl,
          file_name: productFile.name,
          file_size_bytes: productFile.size,
          version,
          changelog: changelog.trim() || null,
        }),
      })

      if (!productRes.ok) {
        const errData = await productRes.json()
        throw new Error(errData.error?.message || 'Failed to create product')
      }

      // Success — redirect to seller dashboard
      router.push('/seller/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/seller/dashboard" className="text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Upload New Product</h1>
          <p className="text-(--color-text-secondary) text-sm mt-1">Fill in the details below. You can save as draft or submit for review.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-none bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form className="space-y-6">
        {/* Title & Slug */}
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
              placeholder="e.g. React Dashboard Template"
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
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none font-mono text-sm"
            />
            <p className="text-xs text-(--color-text-muted) mt-1">Auto-generated from title. This will be the product URL.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Short Description</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="A brief one-line description"
              maxLength={200}
              className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Full Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of your product. Include features, requirements, installation steps..."
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
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none pl-7 pr-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
                  required
                />
              </div>
              <p className="text-xs text-(--color-text-muted) mt-1">Personal tier base price. You earn 85% = ${priceDollars ? (parseFloat(priceDollars) * 0.85).toFixed(2) : '0.00'}</p>
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
              placeholder="react, dashboard, admin, typescript (comma-separated)"
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
            Your uploaded ZIP is scanned automatically for quality metrics and
            AI-generated-code tells. The full quality report is always public.
            You can choose whether to show the AI-detection section to buyers.
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
                Hiding it still leaves the quality report visible. You and admins always see the AI analysis.
              </p>
            </div>
          </label>
        </div>

        {/* Files */}
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            Files
          </h2>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Thumbnail Image</label>
            <label className="flex items-center gap-3 bg-(--color-elevated) border border-(--color-border) border-dashed rounded-none p-4 cursor-pointer hover:border-(--brand-primary) transition-colors">
              <ImageIcon className="h-8 w-8 text-(--color-text-muted)" />
              <div className="flex-1">
                {thumbnailFile ? (
                  <span className="text-sm text-(--color-text-primary)">{thumbnailFile.name}</span>
                ) : (
                  <span className="text-sm text-(--color-text-muted)">Click to upload a preview image (PNG, JPG)</span>
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

          {/* Product File */}
          <div>
            <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Product File (ZIP) *</label>
            <label className="flex items-center gap-3 bg-(--color-elevated) border border-(--color-border) border-dashed rounded-none p-4 cursor-pointer hover:border-(--brand-primary) transition-colors">
              <FileCode className="h-8 w-8 text-(--color-text-muted)" />
              <div className="flex-1">
                {productFile ? (
                  <div>
                    <span className="text-sm text-(--color-text-primary)">{productFile.name}</span>
                    <span className="text-xs text-(--color-text-muted) ml-2">({(productFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ) : (
                  <span className="text-sm text-(--color-text-muted)">Click to upload your code package (ZIP, TAR.GZ)</span>
                )}
              </div>
              <input
                type="file"
                accept=".zip,.tar.gz,.tgz,.rar"
                onChange={(e) => setProductFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {/* Version info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-(--color-text-secondary) mb-1.5">Changelog</label>
              <input
                type="text"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="Initial release"
                className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none px-4 py-2.5 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-none font-medium text-(--color-text-secondary) bg-(--color-elevated) hover:bg-(--color-elevated) border border-(--color-border) transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'pending')}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-none font-medium text-(--color-text-primary) bg-(--brand-primary) hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
            ) : (
              <>Submit for Review</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
