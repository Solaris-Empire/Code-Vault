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
        if (!thumbRes.ok) throw new Error('Failed to upload thumbnail')
        const thumbData = await thumbRes.json()
        thumbnailUrl = thumbData.url || thumbData.data?.url
      }

      // Step 2: Upload product file to Supabase Storage
      const fileFormData = new FormData()
      fileFormData.append('file', productFile)
      fileFormData.append('bucket', 'product-files')

      const fileRes = await fetch('/api/upload', { method: 'POST', body: fileFormData })
      if (!fileRes.ok) throw new Error('Failed to upload product file')
      const fileData = await fileRes.json()
      const fileUrl = fileData.url || fileData.data?.url

      // Step 3: Create the product via API
      const priceCents = Math.round(parseFloat(priceDollars) * 100)
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)

      const productRes = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          short_description: shortDescription.trim(),
          description: description.trim(),
          price_cents: priceCents,
          category_id: categoryId,
          demo_url: demoUrl.trim() || null,
          thumbnail_url: thumbnailUrl,
          tags: tagArray,
          status: saveAs,
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
        <Link href="/seller/dashboard" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Upload New Product</h1>
          <p className="text-gray-400 text-sm mt-1">Fill in the details below. You can save as draft or submit for review.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form className="space-y-6">
        {/* Title & Slug */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-400" />
            Basic Info
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. React Dashboard Template"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">URL Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-generated from title. This will be the product URL.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Short Description</label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="A brief one-line description"
              maxLength={200}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of your product. Include features, requirements, installation steps..."
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-y"
            />
          </div>
        </div>

        {/* Pricing & Category */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            Pricing & Category
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Price (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">You earn 85% = ${priceDollars ? (parseFloat(priceDollars) * 0.85).toFixed(2) : '0.00'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
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
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="h-4 w-4" /> Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, dashboard, admin, typescript (comma-separated)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4" /> Demo URL
            </label>
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://demo.example.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
            />
          </div>
        </div>

        {/* Files */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            Files
          </h2>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Thumbnail Image</label>
            <label className="flex items-center gap-3 bg-gray-800 border border-gray-700 border-dashed rounded-lg p-4 cursor-pointer hover:border-violet-500 transition-colors">
              <ImageIcon className="h-8 w-8 text-gray-600" />
              <div className="flex-1">
                {thumbnailFile ? (
                  <span className="text-sm text-white">{thumbnailFile.name}</span>
                ) : (
                  <span className="text-sm text-gray-500">Click to upload a preview image (PNG, JPG)</span>
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
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product File (ZIP) *</label>
            <label className="flex items-center gap-3 bg-gray-800 border border-gray-700 border-dashed rounded-lg p-4 cursor-pointer hover:border-violet-500 transition-colors">
              <FileCode className="h-8 w-8 text-gray-600" />
              <div className="flex-1">
                {productFile ? (
                  <div>
                    <span className="text-sm text-white">{productFile.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({(productFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Click to upload your code package (ZIP, TAR.GZ)</span>
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
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Changelog</label>
              <input
                type="text"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="Initial release"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
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
            className="px-6 py-2.5 rounded-lg font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'pending')}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors disabled:opacity-50"
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
