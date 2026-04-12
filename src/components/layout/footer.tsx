import Link from "next/link";
import { Code2, Shield, Zap, Heart } from "lucide-react";

const columns = [
  {
    title: "Marketplace",
    links: [
      { label: "Browse All", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Featured", href: "/products?featured=true" },
      { label: "Trending", href: "/products?sort=popular" },
      { label: "New Releases", href: "/products?sort=new" },
    ],
  },
  {
    title: "Categories",
    links: [
      { label: "PHP Scripts", href: "/categories/php-scripts" },
      { label: "React & Next.js", href: "/categories/react-nextjs" },
      { label: "WordPress Themes", href: "/categories/wordpress-themes" },
      { label: "Mobile Apps", href: "/categories/mobile-apps" },
      { label: "UI Kits", href: "/categories/ui-kits" },
    ],
  },
  {
    title: "For Sellers",
    links: [
      { label: "Become a Seller", href: "/register?role=seller" },
      { label: "Seller Dashboard", href: "/seller/dashboard" },
      { label: "Pricing & Payouts", href: "/sell" },
      { label: "Seller Guidelines", href: "/sell/guidelines" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/support" },
      { label: "FAQ", href: "/faq" },
      { label: "License Terms", href: "/terms" },
      { label: "Refund Policy", href: "/returns" },
      { label: "Contact Us", href: "/support" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="bg-(--brand-dark) text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        {/* Top — logo + columns */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="h-10 w-10 rounded-xl bg-(--brand-primary) flex items-center justify-center">
                <Code2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold text-white tracking-tight">
                  CodeVault
                </span>
                <span className="text-[11px] font-medium text-white/40 tracking-[0.12em] uppercase mt-0.5">
                  Premium code marketplace
                </span>
              </div>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed max-w-sm">
              The marketplace for developers by developers. Buy and sell premium
              code, scripts, themes, and templates. Sellers keep 85% of every sale.
            </p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
              <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                <Shield className="h-3.5 w-3.5 text-(--brand-amber)" />
                Stripe Secure
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                <Zap className="h-3.5 w-3.5 text-(--brand-amber)" />
                Instant Downloads
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                <Heart className="h-3.5 w-3.5 text-(--brand-amber)" />
                50K+ Developers
              </span>
            </div>
          </div>

          {/* Column links */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4 tracking-tight">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc.
            All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-white/40">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-white transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
