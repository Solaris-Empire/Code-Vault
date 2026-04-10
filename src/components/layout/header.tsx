'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  User,
  Search,
  Menu,
  LogOut,
  Package,
  Code2,
  FileCode,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/hooks/use-auth'

interface Category {
  name: string
  slug: string
  icon: string | null
  id?: string
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [isScrolled, setIsScrolled] = useState(false)
  const { user, signOut } = useAuth()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories')
        const result = await response.json()
        const cats = result.data || result
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats.map((cat: Category) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon || null,
          })))
        }
      } catch {
        // Fallback - no categories shown
      }
    }
    fetchCategories()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <header className={cn(
      'nav-light w-full z-40 transition-all duration-300',
      isScrolled ? 'sticky top-0 shadow-sm' : ''
    )}>
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Code2 className="h-7 w-7 text-green-600" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">CodeVault</span>
          </Link>

          {/* Nav Links - Desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <Link
              href="/products"
              className={cn(
                'px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                pathname === '/products'
                  ? 'text-green-700 bg-green-50'
                  : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
              )}
            >
              Browse
            </Link>
            <Link
              href="/categories"
              className={cn(
                'px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                pathname === '/categories'
                  ? 'text-green-700 bg-green-50'
                  : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
              )}
            >
              Categories
            </Link>
          </nav>

          {/* Search - Desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-4">
            <div className="flex w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 focus-within:border-green-400 focus-within:bg-white transition-all">
              <Input
                type="search"
                placeholder="Search scripts, templates, plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 h-10 px-4 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm bg-transparent text-gray-900 placeholder:text-gray-400"
              />
              <Button type="submit" className="bg-green-600 hover:bg-green-700 rounded-none px-4 h-10 border-0 transition-colors">
                <Search className="h-4 w-4 text-white" />
              </Button>
            </div>
          </form>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-green-700 hover:bg-green-50 transition-all">
                    <User className="h-5 w-5" />
                    <span className="hidden sm:inline text-sm">Account</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white border-gray-200 text-gray-900">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                  <DropdownMenuItem asChild className="hover:bg-green-50 focus:bg-green-50">
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="hover:bg-green-50 focus:bg-green-50">
                    <Link href="/dashboard/purchases" className="flex items-center gap-2">
                      <Package className="h-4 w-4" /> My Purchases
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="hover:bg-green-50 focus:bg-green-50">
                    <Link href="/seller/dashboard" className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" /> Seller Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-100" />
                  <DropdownMenuItem onClick={signOut} className="text-red-600 hover:bg-red-50 focus:bg-red-50">
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-gray-900 text-sm transition-colors hidden sm:inline">
                  Sign In
                </Link>
                <Link href="/register" className="btn-primary text-white px-5 py-2 rounded-lg text-sm font-medium">
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden p-2 text-gray-600 hover:text-gray-900">
                  <Menu className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] bg-white border-gray-200 text-gray-900 p-0">
                <SheetHeader className="p-4 border-b border-gray-100">
                  <SheetTitle className="flex items-center gap-2 text-gray-900">
                    <Code2 className="h-6 w-6 text-green-600" />
                    <span className="font-bold">CodeVault</span>
                  </SheetTitle>
                </SheetHeader>

                {/* Mobile Search */}
                <form onSubmit={handleSearch} className="px-4 py-3">
                  <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <Input
                      type="search"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 border-0 h-10 px-4 focus-visible:ring-0 text-sm bg-transparent text-gray-900"
                    />
                    <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 rounded-none h-10 px-3">
                      <Search className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </form>

                <nav className="px-2 space-y-0.5">
                  <Link
                    href="/products"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                      pathname === '/products' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <span className="text-sm font-medium">Browse All</span>
                  </Link>
                  <Link
                    href="/categories"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                      pathname === '/categories' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <span className="text-sm font-medium">Categories</span>
                  </Link>

                  <div className="px-3 pt-4 pb-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Categories</p>
                  </div>

                  {categories.slice(0, 8).map((category) => (
                    <Link
                      key={category.slug}
                      href={`/categories/${category.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
                    >
                      <span className="text-sm font-medium">{category.name}</span>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
