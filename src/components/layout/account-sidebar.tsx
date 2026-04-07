'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  User,
  Package,
  RotateCcw,
  MapPin,
  Heart,
  Gift,
  Users,
  Bell,
  MessageSquare,
  CreditCard,
  Shield,
  Settings,
} from 'lucide-react'

const accountLinks = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/profile', label: 'Profile', icon: User },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/returns', label: 'Returns', icon: RotateCcw },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/rewards', label: 'Rewards', icon: Gift },
  { href: '/account/referrals', label: 'Referrals', icon: Users },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/tickets', label: 'Tickets', icon: MessageSquare },
  { href: '/account/payments', label: 'Payments', icon: CreditCard },
  { href: '/account/security', label: 'Security', icon: Shield },
  { href: '/account/settings', label: 'Settings', icon: Settings },
]

export function AccountSidebar() {
  const pathname = usePathname()

  return (
    <nav className="bg-white rounded-lg border p-4 space-y-1">
      {accountLinks.map((link) => {
        const isActive =
          link.href === '/account'
            ? pathname === '/account'
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive
                ? 'bg-green-50 text-green-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
