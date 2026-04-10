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
    <div className="min-h-screen bg-[#050510] text-white">
      {/* ===== NAV ===== */}
      <nav className="glass-nav sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative">
              <Code2 className="h-7 w-7 text-violet-400" />
              <div className="absolute inset-0 bg-violet-500/20 blur-lg rounded-full" />
            </div>
            <span className="text-xl font-bold tracking-tight">CodeVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/products" className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
              Browse
            </Link>
            <Link href="/categories" className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
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
              className="btn-premium text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-36">
        {/* Ambient glow orbs */}
        <div className="glow-orb glow-orb-violet w-[600px] h-[600px] -top-40 left-1/2 -translate-x-1/2 animate-pulse-glow" />
        <div className="glow-orb glow-orb-purple w-[400px] h-[400px] top-20 -left-40 animate-pulse-glow delay-1000" />
        <div className="glow-orb glow-orb-cyan w-[300px] h-[300px] top-40 -right-20 animate-pulse-glow delay-500" />

        {/* Dot grid */}
        <div className="absolute inset-0 dot-pattern opacity-40" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass-surface rounded-full px-5 py-2 mb-8">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-violet-300 font-medium">The marketplace for developers</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.05] tracking-tight">
              Buy & Sell
              <br />
              <span className="text-gradient-hero">Premium Code</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Discover thousands of scripts, templates, themes, and plugins.
              Start selling your code and earn <span className="text-violet-300 font-semibold">85% on every sale</span>.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/products"
                className="btn-premium inline-flex items-center justify-center gap-2 text-white px-8 py-3.5 rounded-xl font-semibold text-base"
              >
                Browse Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register?role=seller"
                className="btn-glass inline-flex items-center justify-center gap-2 text-white px-8 py-3.5 rounded-xl font-semibold text-base"
              >
                Start Selling
                <FileCode className="h-4 w-4" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                Secure Payments
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                Instant Downloads
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                License Included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="relative border-y border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-950/20 via-transparent to-violet-950/20" />
        <div className="container mx-auto px-4 py-10 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10K+', label: 'Products', icon: FileCode },
              { value: '50K+', label: 'Developers', icon: Users },
              { value: '1M+', label: 'Downloads', icon: Download },
              { value: '4.9', label: 'Avg Rating', icon: Star },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center group">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                  <stat.icon className="h-5 w-5 text-violet-400" />
                </div>
                <span className="text-3xl md:text-4xl font-bold tracking-tight text-gradient">{stat.value}</span>
                <span className="text-gray-500 text-sm mt-1">{stat.label}</span>
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
              <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-2 block">Explore</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Browse Categories</h2>
              <p className="text-gray-500 mt-2">Find the perfect code for your project</p>
            </div>
            <Link
              href="/categories"
              className="hidden md:flex text-violet-400 hover:text-violet-300 text-sm font-medium items-center gap-1.5 transition-colors"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {safeCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="glass-card group rounded-xl p-5 md:p-6"
              >
                <div className="text-2xl md:text-3xl mb-3">{category.icon || '📦'}</div>
                <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">
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

      {/* ===== FEATURED PRODUCTS ===== */}
      {safeFeatured.length > 0 && (
        <section className="py-16 md:py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 via-transparent to-transparent" />
          <div className="container mx-auto px-4 relative">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-2 block">Curated</span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Featured Items</h2>
                <p className="text-gray-500 mt-2">Hand-picked by our team</p>
              </div>
              <Link
                href="/products?featured=true"
                className="hidden md:flex text-violet-400 hover:text-violet-300 text-sm font-medium items-center gap-1.5 transition-colors"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {safeFeatured.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="product-card glass-card group rounded-xl overflow-hidden"
                >
                  <div className="aspect-[16/10] bg-[#0a0a1a] relative overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-10 w-10 text-gray-700" />
                      </div>
                    )}
                    {/* Featured badge */}
                    <div className="absolute top-3 left-3 bg-violet-600/90 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </div>
                  </div>
                  <div className="p-4 relative z-10">
                    <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                      by {(product.seller as { display_name: string } | null)?.display_name || 'Unknown'}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-lg font-bold text-gradient">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 text-gray-500 text-sm">
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
                <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-2 block">New</span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Latest Additions</h2>
                <p className="text-gray-500 mt-2">Fresh code, just uploaded</p>
              </div>
              <Link
                href="/products"
                className="hidden md:flex text-violet-400 hover:text-violet-300 text-sm font-medium items-center gap-1.5 transition-colors"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {safeLatest.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="product-card glass-card group rounded-xl overflow-hidden"
                >
                  <div className="aspect-[16/10] bg-[#0a0a1a] relative overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Code2 className="h-10 w-10 text-gray-700" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-white/[0.04] text-gray-400 px-2.5 py-0.5 rounded-full border border-white/[0.04]">
                        {(product.category as { name: string } | null)?.name || 'Uncategorized'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                      {product.short_description}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-lg font-bold text-gradient">
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

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-16 md:py-24 relative">
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-14">
            <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-2 block">Simple</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How It Works</h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">Start earning or building in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                step: '01',
                icon: Users,
                title: 'Create Account',
                desc: 'Sign up as a buyer or seller in seconds with email or Google.',
              },
              {
                step: '02',
                icon: Code2,
                title: 'Upload or Browse',
                desc: 'Sellers upload code with demos. Buyers search thousands of products.',
              },
              {
                step: '03',
                icon: TrendingUp,
                title: 'Earn or Build',
                desc: 'Sellers earn 85% per sale. Buyers get instant downloads with license.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="glass-card rounded-2xl p-6 md:p-8 text-center relative group"
              >
                {/* Step number */}
                <div className="text-5xl font-black text-white/[0.03] absolute top-4 right-5 select-none">
                  {item.step}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-violet-500/20 transition-colors">
                  <item.icon className="h-7 w-7 text-violet-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-[#0e0e2a] to-purple-950/40" />
        <div className="glow-orb glow-orb-violet w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse-glow" />
        <div className="absolute inset-0 dot-pattern opacity-20" />

        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">
              Start Selling Your Code <span className="text-gradient">Today</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Join thousands of developers earning passive income.
              You keep 85% of every sale — we handle payments, hosting, and delivery.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register?role=seller"
                className="btn-premium inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-base"
              >
                Create Seller Account
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/products"
                className="btn-glass inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-base"
              >
                Explore Marketplace
              </Link>
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-violet-400/60" />
                Stripe Secure
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-violet-400/60" />
                License Protection
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-violet-400/60" />
                Instant Payouts
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.04] bg-[#050510] py-14">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Code2 className="h-6 w-6 text-violet-400" />
                <span className="text-lg font-bold tracking-tight">CodeVault</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                The marketplace for developers. Buy and sell premium code.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm text-gray-300">Marketplace</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><Link href="/products" className="hover:text-violet-400 transition-colors">Browse All</Link></li>
                <li><Link href="/categories" className="hover:text-violet-400 transition-colors">Categories</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm text-gray-300">Sellers</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><Link href="/register?role=seller" className="hover:text-violet-400 transition-colors">Become a Seller</Link></li>
                <li><Link href="/seller/dashboard" className="hover:text-violet-400 transition-colors">Seller Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm text-gray-300">Company</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><span>Solaris Empire Inc.</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] mt-10 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-600 text-sm">
              &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5 text-gray-600 text-sm mt-2 md:mt-0">
              <Shield className="h-4 w-4" />
              Secure payments via Stripe
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
