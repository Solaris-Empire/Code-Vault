'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid3X3, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const tabs = [
  { href: '/', label: 'Home', icon: Home, matchExact: true },
  { href: '/categories', label: 'Categories', icon: Grid3X3 },
  { href: '/products', label: 'Browse', icon: Search },
  { href: '/dashboard', label: 'Account', icon: User },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (tab: (typeof tabs)[number]) => {
    if (tab.matchExact) return pathname === tab.href
    return pathname.startsWith(tab.href)
  }

  // Hide on admin and seller pages
  if (pathname.startsWith('/admin') || pathname.startsWith('/seller')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950 border-t border-gray-800 lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors',
                active ? 'text-violet-400' : 'text-gray-500'
              )}
            >
              <tab.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className={cn('text-[10px] leading-tight', active && 'font-semibold')}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
