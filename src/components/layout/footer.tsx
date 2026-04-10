import Link from 'next/link'
import { Code2, Shield } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-[#050510] border-t border-white/[0.04] text-gray-400">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Code2 className="h-6 w-6 text-violet-400" />
              <span className="text-lg font-bold text-white tracking-tight">CodeVault</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              The marketplace for developers. Buy and sell premium code, scripts, and templates.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-semibold text-gray-300 mb-4 text-sm">Marketplace</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/products" className="hover:text-violet-400 transition-colors">
                  Browse All
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-violet-400 transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/products?featured=true" className="hover:text-violet-400 transition-colors">
                  Featured Items
                </Link>
              </li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h4 className="font-semibold text-gray-300 mb-4 text-sm">Sellers</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/register?role=seller" className="hover:text-violet-400 transition-colors">
                  Become a Seller
                </Link>
              </li>
              <li>
                <Link href="/seller/dashboard" className="hover:text-violet-400 transition-colors">
                  Seller Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-gray-300 mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><span>Solaris Empire Inc.</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.04] mt-10 pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-gray-600 text-sm mt-2 md:mt-0">
            <Shield className="h-4 w-4" />
            Secure payments via Stripe
          </div>
        </div>
      </div>
    </footer>
  )
}
