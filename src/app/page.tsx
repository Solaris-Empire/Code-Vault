import Link from 'next/link'
import {
  ArrowRight,
  Code2,
  Download,
  Shield,
  Star,
  Users,
  Zap,
  FileCode,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// ISR: revalidate homepage every 60 seconds
export const revalidate = 60

export default async function HomePage() {
  const supabase = getSupabaseAdmin()

  // Fetch categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  // Fetch featured/approved products
  const { data: featuredProducts } = await supabase
    .from('products')
    .select('*, seller:users(display_name), category:categories(name, slug)')
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(8)

  // Fetch latest products
  const { data: latestProducts } = await supabase
    .from('products')
    .select('*, seller:users(display_name), category:categories(name, slug)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(12)

  const safeCategories = categories || []
  const safeFeatured = featuredProducts || []
  const safeLatest = latestProducts || []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-violet-500" />
            <span className="text-xl font-bold">CodeVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/products" className="text-gray-400 hover:text-white transition-colors">
              Browse
            </Link>
            <Link href="/categories" className="text-gray-400 hover:text-white transition-colors">
              Categories
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/50 via-gray-950 to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/20 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-violet-300">The marketplace for developers</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Buy & Sell
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                {' '}Premium Code
              </span>
            </h1>

            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Discover thousands of scripts, templates, themes, and plugins.
              Start selling your code and earn 85% on every sale.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Browse Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register?role=seller"
                className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors border border-gray-700"
              >
                Start Selling
                <FileCode className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '10K+', label: 'Products', icon: FileCode },
              { value: '50K+', label: 'Developers', icon: Users },
              { value: '1M+', label: 'Downloads', icon: Download },
              { value: '4.9', label: 'Avg Rating', icon: Star },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <stat.icon className="h-5 w-5 text-violet-400 mb-2" />
                <span className="text-2xl md:text-3xl font-bold">{stat.value}</span>
                <span className="text-gray-500 text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Browse Categories</h2>
              <p className="text-gray-500 mt-1">Find the perfect code for your project</p>
            </div>
            <Link
              href="/categories"
              className="text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {safeCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-violet-500/50 hover:bg-gray-900/80 transition-all"
              >
                <div className="text-2xl mb-3">{category.icon || '📦'}</div>
                <h3 className="font-semibold text-white group-hover:text-violet-400 transition-colors">
                  {category.name}
                </h3>
                <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                  {category.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {safeFeatured.length > 0 && (
        <section className="py-12 md:py-20 bg-gray-900/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Featured Items</h2>
                <p className="text-gray-500 mt-1">Hand-picked by our team</p>
              </div>
              <Link
                href="/products?featured=true"
                className="text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {safeFeatured.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-violet-500/50 transition-all"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/10] bg-gray-800 relative overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-10 w-10 text-gray-700" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white group-hover:text-violet-400 transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                      by {(product.seller as { display_name: string } | null)?.display_name || 'Unknown'}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-violet-400">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 text-gray-500 text-sm">
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                        {product.avg_rating?.toFixed(1) || '0.0'}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Products */}
      {safeLatest.length > 0 && (
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Latest Additions</h2>
                <p className="text-gray-500 mt-1">Fresh code, just uploaded</p>
              </div>
              <Link
                href="/products"
                className="text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {safeLatest.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-violet-500/50 transition-all"
                >
                  <div className="aspect-[16/10] bg-gray-800 relative overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-10 w-10 text-gray-700" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                        {(product.category as { name: string } | null)?.name || 'Uncategorized'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white group-hover:text-violet-400 transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                      {product.short_description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-violet-400">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 text-gray-500 text-sm">
                        <Download className="h-3.5 w-3.5" />
                        {product.download_count || 0}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA - Sell Your Code */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-700" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="container mx-auto px-4 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Selling Your Code Today
          </h2>
          <p className="text-violet-200 text-lg max-w-2xl mx-auto mb-8">
            Join thousands of developers earning passive income.
            You keep 85% of every sale — we handle payments, hosting, and delivery.
          </p>
          <Link
            href="/register?role=seller"
            className="inline-flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Create Seller Account
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="h-6 w-6 text-violet-500" />
                <span className="text-lg font-bold">CodeVault</span>
              </div>
              <p className="text-gray-500 text-sm">
                The marketplace for developers. Buy and sell premium code.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Marketplace</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/products" className="hover:text-white transition-colors">Browse All</Link></li>
                <li><Link href="/categories" className="hover:text-white transition-colors">Categories</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Sellers</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/register?role=seller" className="hover:text-white transition-colors">Become a Seller</Link></li>
                <li><Link href="/seller/dashboard" className="hover:text-white transition-colors">Seller Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><span>Solaris Empire Inc.</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-600 text-sm">
              &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-1 text-gray-600 text-sm mt-2 md:mt-0">
              <Shield className="h-4 w-4" />
              Secure payments via Stripe
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
