import Link from 'next/link'
import { Code2, FolderOpen } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'

import type { Metadata } from 'next'

// ─── ISR: revalidate every 60 seconds ────────────────────────────────
// This means the page is statically generated, but Next.js will rebuild it
// in the background every 60s so data stays fresh without being fully dynamic.
export const revalidate = 60

// ─── Page metadata ───────────────────────────────────────────────────
// This sets the <title> tag and can be extended for Open Graph, etc.
export const metadata: Metadata = {
  title: 'Categories | CodeVault',
  description: 'Browse all code categories on CodeVault — find PHP scripts, JavaScript, React, WordPress, and more.',
}

// ─── Type definitions ────────────────────────────────────────────────
// We define explicit types instead of using `any` (strict TypeScript).
interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
  sort_order: number
}

// This type represents the result of counting products per category.
// Supabase returns `[{ count: number }]` when you use `.select('id', { count: 'exact' })`.
interface ProductCountResult {
  category_id: string
  count: number
}

export default async function CategoriesPage() {
  const supabase = getSupabaseAdmin()

  // ─── Fetch all categories ordered by sort_order ──────────────────
  // We want them in the specific order Kevin set in the DB (e.g., most popular first).
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  // Safe fallback — if the query fails we still render the page (empty state).
  const safeCategories: Category[] = categories || []

  // ─── Fetch product counts per category ───────────────────────────
  // We only count APPROVED products so buyers don't see inflated numbers.
  // We use a separate query and merge the counts into the category cards.
  const { data: productCounts } = await supabase
    .from('products')
    .select('category_id')
    .eq('status', 'approved')

  // Build a lookup map: { category_id -> count }
  // This is more efficient than making N queries (one per category).
  const countMap: Record<string, number> = {}
  if (productCounts) {
    for (const row of productCounts) {
      const catId = row.category_id as string
      countMap[catId] = (countMap[catId] || 0) + 1
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ─── Page header ─────────────────────────────────────────── */}
      <section className="border-b border-gray-800 bg-gray-900/30">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Categories</h1>
          <p className="text-gray-400 max-w-2xl">
            Explore our curated collection of code categories. From PHP scripts to
            full applications — find exactly what you need for your next project.
          </p>
        </div>
      </section>

      {/* ─── Category grid ───────────────────────────────────────── */}
      <section className="py-10 md:py-16">
        <div className="container mx-auto px-4">
          {safeCategories.length === 0 ? (
            /* Empty state — shown when no categories exist yet */
            <div className="text-center py-20">
              <FolderOpen className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-400">No categories yet</h2>
              <p className="text-gray-600 mt-2">
                Categories will appear here once an admin creates them.
              </p>
            </div>
          ) : (
            /* Grid: 2 cols on mobile, 3 on md, 4 on lg — responsive for all screens */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {safeCategories.map((category) => {
                // Look up how many approved products are in this category
                const productCount = countMap[category.id] || 0

                return (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-violet-500/50 hover:bg-gray-900/80 transition-all"
                  >
                    {/* Icon — use the emoji from the DB, or a default fallback */}
                    <div className="text-3xl mb-3">
                      {category.icon || '📦'}
                    </div>

                    {/* Category name */}
                    <h3 className="font-semibold text-white group-hover:text-violet-400 transition-colors">
                      {category.name}
                    </h3>

                    {/* Description — clamped to 2 lines so cards stay uniform */}
                    {category.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                        {category.description}
                      </p>
                    )}

                    {/* Product count badge */}
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
