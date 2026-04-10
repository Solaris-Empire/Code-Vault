import Link from 'next/link'
import { Code2, FolderOpen } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Categories | CodeVault',
  description: 'Browse all code categories on CodeVault — find PHP scripts, JavaScript, React, WordPress, and more.',
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
  sort_order: number
}

export default async function CategoriesPage() {
  const supabase = getSupabaseAdmin()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  const safeCategories: Category[] = categories || []

  const { data: productCounts } = await supabase
    .from('products')
    .select('category_id')
    .eq('status', 'approved')

  const countMap: Record<string, number> = {}
  if (productCounts) {
    for (const row of productCounts) {
      const catId = row.category_id as string
      countMap[catId] = (countMap[catId] || 0) + 1
    }
  }

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      {/* Page header */}
      <section className="relative border-b border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 to-transparent" />
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="container mx-auto px-4 py-14 md:py-20 relative">
          <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-2 block">Explore</span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">Categories</h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed">
            Explore our curated collection of code categories. From PHP scripts to
            full applications — find exactly what you need for your next project.
          </p>
        </div>
      </section>

      {/* Category grid */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          {safeCategories.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5">
                <FolderOpen className="h-10 w-10 text-gray-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-400">No categories yet</h2>
              <p className="text-gray-600 mt-2">
                Categories will appear here once an admin creates them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {safeCategories.map((category) => {
                const productCount = countMap[category.id] || 0

                return (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="glass-card group rounded-xl p-5 md:p-6"
                  >
                    <div className="text-3xl mb-3">
                      {category.icon || '📦'}
                    </div>
                    <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                      <Code2 className="h-3.5 w-3.5" />
                      <span>
                        {productCount} {productCount === 1 ? 'product' : 'products'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
