import Link from 'next/link'
import { Code2 } from 'lucide-react'

// Seller area layout — wraps all /seller/* pages with consistent nav
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--color-background) text-(--color-text-primary)">
      {/* Seller top bar */}
      <nav className="border-b border-(--color-border) bg-(--color-surface)/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Code2 className="h-6 w-6 text-(--brand-primary)" />
              <span className="text-lg font-bold">CodeVault</span>
            </Link>
            <span className="text-(--color-text-muted)">|</span>
            <span className="text-sm text-(--color-text-secondary) font-medium">Seller Dashboard</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/seller/dashboard" className="text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
              Overview
            </Link>
            <Link href="/seller/products/new" className="text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
              Upload
            </Link>
            <Link href="/" className="text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
              Back to Store
            </Link>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
