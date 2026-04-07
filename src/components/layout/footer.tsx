import Link from 'next/link'
import { Code2, Shield } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-400">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Code2 className="h-6 w-6 text-violet-500" />
              <span className="text-lg font-bold text-white">CodeVault</span>
            </div>
            <p className="text-sm text-gray-500">
              The marketplace for developers. Buy and sell premium code, scripts, and templates.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-semibold text-white mb-3">Marketplace</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="hover:text-white transition-colors">
                  Browse All
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-white transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/products?featured=true" className="hover:text-white transition-colors">
                  Featured Items
                </Link>
              </li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h4 className="font-semibold text-white mb-3">Sellers</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/register?role=seller" className="hover:text-white transition-colors">
                  Become a Seller
                </Link>
              </li>
              <li>
                <Link href="/seller/dashboard" className="hover:text-white transition-colors">
                  Seller Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><span>Solaris Empire Inc.</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-gray-600 text-sm mt-2 md:mt-0">
            <Shield className="h-4 w-4" />
            Secure payments via Stripe
          </div>
        </div>
      </div>
    </footer>
  )
}
