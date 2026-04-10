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
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Lock,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const revalidate = 60

export default async function HomePage() {
  const supabase = getSupabaseAdmin()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: featuredProducts } = await supabase
    .from('products')
    .select('*, seller:users(display_name), category:categories(name, slug)')
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(8)

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
    <div className="min-h-screen bg-white text-gray-900">
      {/* ===== NAV ===== */}
      <nav className="nav-light sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-green-600" />
            <span className="text-xl font-bold tracking-tight text-gray-900">CodeVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/products" className="px-4 py-2 text-sm text-gray-600 hover:text-green-700 rounded-lg hover:bg-green-50 transition-all">
              Browse
            </Link>
            <Link href="/categories" className="px-4 py-2 text-sm text-gray-600 hover:text-green-700 rounded-lg hover:bg-green-50 transition-all">
              Categories
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary text-white px-5 py-2 rounded-lg text-sm font-medium">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
        {/* Soft green gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-50 via-white to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-100/50 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-5 py-2 mb-8">
              <Zap className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">The marketplace for developers</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight text-gray-900">
              Buy & Sell
              <br />
              <span className="text-gradient-green">Premium Code</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Discover thousands of scripts, templates, themes, and plugins.
              Start selling your code and earn <span className="text-green-600 font-semibold">85% on every sale</span>.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/products"
                className="btn-primary inline-flex items-center justify-center gap-2 text-white px-8 py-3.5 rounded-xl font-semibold text-base"
              >
                Browse Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register?role=seller"
                className="btn-outline inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-base"
              >
                Start Selling
                <FileCode className="h-4 w-4" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Secure Payments
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Instant Downloads
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                License Included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10K+', label: 'Products', icon: FileCode },
              { value: '50K+', label: 'Developers', icon: Users },
              { value: '1M+', label: 'Downloads', icon: Download },
              { value: '4.9', label: 'Avg Rating', icon: Star },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center group">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                  <stat.icon className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">{stat.value}</span>
                <span className="text-gray-400 text-sm mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-green-600 text-sm font-semibold tracking-wider uppercase mb-2 block">Explore</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Browse Categories</h2>
              <p className="text-gray-400 mt-2">Find the perfect code for your project</p>
            </div>
            <Link
              href="/categories"
              className="hidden md:flex text-green-600 hover:text-green-700 text-sm font-medium items-center gap-1.5 transition-colors"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {safeCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="card group rounded-xl p-5 md:p-6"
              >
                <div className="text-2xl md:text-3xl mb-3">{category.icon || '📦'}</div>
                <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                  {category.name}
                </h3>
                <p className="text-gray-400 text-sm mt-1 line-clamp-1">
                  {category.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED PRODUCTS ===== */}
      {safeFeatured.length > 0 && (
        <section className="py-16 md:py-24 bg-green-50/30">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-green-600 text-sm font-semibold tracking-wider uppercase mb-2 block">Curated</span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Featured Items</h2>
                <p className="text-gray-400 mt-2">Hand-picked by our team</p>
              </div>
              <Link
                href="/products?featured=true"
                className="hidden md:flex text-green-600 hover:text-green-700 text-sm font-medium items-center gap-1.5 transition-colors"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {safeFeatured.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="product-card group"
                >
                  <div className="aspect-[16/10] bg-gray-50 relative overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-1">
                      by {(product.seller as { display_name: string } | null)?.display_name || 'Unknown'}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-lg font-bold text-green-600">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
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

      {/* ===== LATEST PRODUCTS ===== */}
      {safeLatest.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-green-600 text-sm font-semibold tracking-wider uppercase mb-2 block">New</span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Latest Additions</h2>
                <p className="text-gray-400 mt-2">Fresh code, just uploaded</p>
              </div>
              <Link
                href="/products"
                className="hidden md:flex text-green-600 hover:text-green-700 text-sm font-medium items-center gap-1.5 transition-colors"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {safeLatest.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="product-card group"
                >
                  <div className="aspect-[16/10] bg-gray-50 relative overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full">
                        {(product.category as { name: string } | null)?.name || 'Uncategorized'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-1">
                      {product.short_description}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-lg font-bold text-green-600">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
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

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-16 md:py-24 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="text-green-600 text-sm font-semibold tracking-wider uppercase mb-2 block">Simple</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">How It Works</h2>
            <p className="text-gray-400 mt-2 max-w-xl mx-auto">Start earning or building in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { step: '01', icon: Users, title: 'Create Account', desc: 'Sign up as a buyer or seller in seconds with email or Google.' },
              { step: '02', icon: Code2, title: 'Upload or Browse', desc: 'Sellers upload code with demos. Buyers search thousands of products.' },
              { step: '03', icon: TrendingUp, title: 'Earn or Build', desc: 'Sellers earn 85% per sale. Buyers get instant downloads with license.' },
            ].map((item) => (
              <div key={item.step} className="card rounded-2xl p-6 md:p-8 text-center relative group">
                <div className="text-5xl font-black text-gray-100 absolute top-4 right-5 select-none">
                  {item.step}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-green-100 transition-colors">
                  <item.icon className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-500 to-emerald-600" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight text-white">
              Start Selling Your Code Today
            </h2>
            <p className="text-green-100 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Join thousands of developers earning passive income.
              You keep 85% of every sale — we handle payments, hosting, and delivery.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register?role=seller"
                className="inline-flex items-center justify-center gap-2 bg-white text-green-700 hover:bg-green-50 px-8 py-4 rounded-xl font-semibold text-base transition-colors shadow-lg"
              >
                Create Seller Account
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl font-semibold text-base transition-colors"
              >
                Explore Marketplace
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-green-200">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                Stripe Secure
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                License Protection
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                Instant Payouts
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-100 bg-white py-14">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="h-6 w-6 text-green-600" />
                <span className="text-lg font-bold tracking-tight text-gray-900">CodeVault</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                The marketplace for developers. Buy and sell premium code.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm text-gray-900">Marketplace</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link href="/products" className="hover:text-green-600 transition-colors">Browse All</Link></li>
                <li><Link href="/categories" className="hover:text-green-600 transition-colors">Categories</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm text-gray-900">Sellers</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link href="/register?role=seller" className="hover:text-green-600 transition-colors">Become a Seller</Link></li>
                <li><Link href="/seller/dashboard" className="hover:text-green-600 transition-colors">Seller Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm text-gray-900">Company</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><span>Solaris Empire Inc.</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-10 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-2 md:mt-0">
              <Shield className="h-4 w-4" />
              Secure payments via Stripe
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
