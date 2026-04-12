"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  User,
  Menu,
  LogOut,
  Package,
  Code2,
  FileCode,
  LayoutDashboard,
  X,
} from "lucide-react";
import { GlobalSearch } from "@/components/ui/search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navCategories = [
  { name: "PHP", slug: "php-scripts" },
  { name: "JavaScript", slug: "javascript" },
  { name: "React & Next", slug: "react-nextjs" },
  { name: "WordPress", slug: "wordpress-themes" },
  { name: "HTML", slug: "html-templates" },
  { name: "Mobile", slug: "mobile-apps" },
  { name: "UI Kits", slug: "ui-kits" },
  { name: "Full Apps", slug: "full-apps" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 w-full transition-all duration-300",
          "z-(--z-sticky)",
          isScrolled
            ? "nav-glass"
            : "bg-(--color-surface) border-b border-(--color-border)"
        )}
      >
        {/* Main bar */}
        <div className="mx-auto max-w-7xl h-16 flex items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "md:hidden flex items-center justify-center",
              "h-10 w-10 rounded-md",
              "border border-(--color-border)",
              "text-(--color-text-secondary)",
              "hover:bg-(--color-elevated)",
              "transition-colors duration-(--duration-fast)"
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-(--brand-primary) flex items-center justify-center shadow-[0_2px_8px_rgba(27,107,58,0.3)] group-hover:shadow-[0_4px_12px_rgba(27,107,58,0.4)] transition-shadow">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold text-(--brand-dark) tracking-tight">
                CodeVault
              </span>
              <span className="text-[11px] font-medium text-(--color-text-muted) tracking-[0.12em] uppercase mt-0.5">
                Premium code marketplace
              </span>
            </div>
          </Link>

          {/* Search */}
          <div className="hidden md:block flex-1 max-w-2xl mx-auto">
            <GlobalSearch variant="header" placeholder="Search scripts, themes, templates..." />
          </div>

          {/* Account */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center justify-center",
                    "h-10 w-10 rounded-md",
                    "border border-(--color-border)",
                    "text-(--color-text-secondary)",
                    "hover:bg-(--color-elevated)",
                    "transition-colors duration-(--duration-fast)"
                  )}
                  aria-label="Account menu"
                >
                  <User className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-3 border-b border-(--color-border)">
                  <p className="text-sm font-semibold truncate text-foreground">
                    {user.email}
                  </p>
                  <p className="text-xs text-(--color-text-muted) mt-0.5">Manage your account</p>
                </div>
                <DropdownMenuItem onClick={() => router.push("/dashboard")} className="flex items-center gap-2 cursor-pointer">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard/purchases")} className="flex items-center gap-2 cursor-pointer">
                  <Package className="h-4 w-4" /> My Purchases
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/seller/dashboard")} className="flex items-center gap-2 cursor-pointer">
                  <FileCode className="h-4 w-4" /> Seller Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-red-600 focus:text-red-600 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <button
                className={cn(
                  "flex items-center justify-center",
                  "h-10 w-10 rounded-md",
                  "border border-(--color-border)",
                  "text-(--color-text-secondary)",
                  "hover:bg-(--color-elevated)",
                  "transition-colors duration-(--duration-fast)"
                )}
                aria-label="Sign in"
              >
                <User className="h-5 w-5" />
              </button>
            </Link>
          )}

          {/* Become a Seller — the star */}
          <Link
            href="/register?role=seller"
            className={cn(
              "hidden sm:flex items-center gap-2",
              "bg-(--brand-amber) rounded-lg",
              "px-4 h-10 text-white font-medium text-sm",
              "shadow-(--shadow-amber)",
              "hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(232,134,26,0.4)]",
              "active:translate-y-0",
              "transition-all duration-(--duration-base)",
              "ease-(--ease-premium)"
            )}
          >
            <FileCode className="h-4 w-4" />
            <span>Start Selling</span>
          </Link>
        </div>

        {/* Category nav row — desktop only */}
        <nav className="hidden md:flex border-t border-(--color-border)">
          <div className="mx-auto max-w-7xl w-full h-11 flex items-center gap-1 px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-hide">
            <Link
              href="/categories"
              className={cn(
                "shrink-0 flex items-center gap-1.5",
                "rounded-md px-3 py-1.5",
                "text-sm font-medium whitespace-nowrap",
                "text-foreground",
                "hover:bg-(--color-elevated)",
                "transition-colors duration-(--duration-fast)",
                pathname === "/categories" && "bg-(--color-elevated)"
              )}
            >
              <Menu className="h-4 w-4" />
              All Categories
            </Link>

            <div className="w-px h-5 bg-(--color-border) shrink-0 mx-0.5" />

            {navCategories.map((cat) => {
              const href = `/categories/${cat.slug}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={cat.slug}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5",
                    "text-sm whitespace-nowrap",
                    "transition-colors duration-(--duration-fast)",
                    isActive
                      ? "bg-(--color-elevated) text-foreground font-medium"
                      : "text-(--color-text-secondary) hover:bg-(--color-elevated)"
                  )}
                >
                  {cat.name}
                </Link>
              );
            })}

            <div className="w-px h-5 bg-(--color-border) shrink-0 mx-0.5" />

            <Link
              href="/products?sort=popular"
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5",
                "text-sm font-medium whitespace-nowrap",
                "transition-colors duration-(--duration-fast)",
                "bg-(--brand-amber-soft) text-(--brand-amber) hover:bg-(--brand-amber) hover:text-white"
              )}
            >
              Trending 🔥
            </Link>
          </div>
        </nav>

        {/* Mobile search row */}
        <div className="md:hidden border-t border-(--color-border) px-4 py-2">
          <GlobalSearch variant="header" placeholder="Search..." />
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-(--z-modal) md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 top-0 bottom-0 w-[300px] bg-(--color-surface) shadow-(--shadow-2xl) flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-(--color-border)">
              <div className="flex items-center gap-2">
                <Code2 className="h-6 w-6 text-(--brand-primary)" />
                <span className="font-bold text-lg">CodeVault</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-(--color-elevated)"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              <Link
                href="/products"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-(--color-elevated)"
              >
                Browse All
              </Link>
              <Link
                href="/categories"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-(--color-elevated)"
              >
                All Categories
              </Link>

              <div className="px-3 pt-4 pb-1">
                <p className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">
                  Categories
                </p>
              </div>

              {navCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/categories/${cat.slug}`}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-(--color-text-secondary) hover:bg-(--color-elevated) hover:text-foreground"
                >
                  {cat.name}
                </Link>
              ))}

              <div className="mt-4 p-3">
                <Link
                  href="/register?role=seller"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-(--brand-amber) text-white rounded-lg h-11 font-semibold text-sm shadow-(--shadow-amber)"
                >
                  <FileCode className="h-4 w-4" />
                  Start Selling
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
