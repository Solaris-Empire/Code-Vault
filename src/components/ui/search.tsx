'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, X, Loader2, Package } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'

interface Product {
  id: string
  name: string
  slug: string
  price_pence: number
  image_url: string | null
  category?: {
    name: string
  }
}

interface GlobalSearchProps {
  variant?: 'header' | 'page'
  placeholder?: string
}

export function GlobalSearch({ variant = 'header', placeholder = 'Search products...' }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=6`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setResults(data)
        }
      } catch (error) {
        console.error('Search error:', error)
      }
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleProductClick = (slug: string) => {
    setIsOpen(false)
    setQuery('')
    router.push(`/products/${slug}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setIsOpen(false)
      router.push(`/products?search=${encodeURIComponent(query)}`)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit}>
        <div className={`relative flex items-center ${
          variant === 'header'
            ? 'bg-slate-100 rounded-xl'
            : 'bg-white border border-slate-200 rounded-xl shadow-sm'
        }`}>
          <Search className="absolute left-3 w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className={`w-full bg-transparent border-none outline-none text-sm text-slate-600 placeholder:text-slate-400 ${
              variant === 'header'
                ? 'pl-10 pr-16 py-2.5 w-64 lg:w-80'
                : 'pl-10 pr-16 py-3 w-full'
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults([])
              }}
              className="absolute right-10 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="absolute right-3 hidden md:inline-flex items-center px-2 py-0.5 text-xs font-medium text-slate-400 bg-white rounded border border-slate-200">
            ⌘K
          </kbd>
        </div>
      </form>

      {/* Dropdown results */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : results.length > 0 ? (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {results.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => handleProductClick(product.slug)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{product.name}</p>
                        {product.category && (
                          <p className="text-xs text-slate-500">{product.category.name}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatPrice(product.price_pence)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                <button
                  onClick={handleSubmit}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  View all results for "{query}" →
                </button>
              </div>
            </>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">No products found for "{query}"</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
