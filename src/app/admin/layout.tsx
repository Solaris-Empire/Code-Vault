import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Code2,
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

// Admin layout — wraps all /admin/* pages with sidebar navigation.
// Server component so we can check auth before rendering.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Auth + admin role check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/admin')
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-950 flex-shrink-0 sticky top-0 h-screen">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 mb-1">
            <Code2 className="h-6 w-6 text-violet-500" />
            <span className="text-lg font-bold">CodeVault</span>
          </Link>
          <span className="text-xs text-gray-600 font-medium">Admin Panel</span>
        </div>

        <nav className="px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-6 left-3 right-3">
          <Link
            href="/"
            className="block text-center text-xs text-gray-600 hover:text-gray-400 transition-colors py-2"
          >
            Back to Store
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
