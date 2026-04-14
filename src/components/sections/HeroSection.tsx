"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  Star,
  ChevronLeft,
  ChevronRight,
  Code2,
  Sparkles,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1920&q=80&auto=format&fit=crop",
    alt: "Premium code on display",
    eyebrow: "Premium code — instant download",
    headline: "Premium Code,",
    headlineAccent: "Ready to Ship",
    subtitle: "Shop 10,000+ scripts, templates, and plugins from top developers. Sellers keep 85% of every sale.",
    cta: { label: "Browse Marketplace", href: "/products" },
    ctaSecondary: { label: "Start Selling", href: "/register?role=seller" },
  },
  {
    image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1920&q=80&auto=format&fit=crop",
    alt: "React and modern frontend templates",
    eyebrow: "React, Next.js & Modern Stacks",
    headline: "Production-Ready",
    headlineAccent: "React Templates",
    subtitle: "Stop building from scratch. Battle-tested Next.js starters, dashboards, and SaaS boilerplates.",
    cta: { label: "Shop React & Next.js", href: "/categories/react-nextjs" },
    ctaSecondary: { label: "View Demos", href: "/products?featured=true" },
  },
  {
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1920&q=80&auto=format&fit=crop",
    alt: "WordPress themes and plugins",
    eyebrow: "WordPress — themes & plugins",
    headline: "WordPress Themes &",
    headlineAccent: "Powerful Plugins",
    subtitle: "Beautiful themes, developer-friendly plugins, and complete WooCommerce solutions.",
    cta: { label: "Shop WordPress", href: "/categories/wordpress-themes" },
    ctaSecondary: { label: "Today's Top", href: "/products?sort=popular" },
  },
  {
    image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1920&q=80&auto=format&fit=crop",
    alt: "Mobile apps — Flutter and React Native",
    eyebrow: "Mobile apps — Flutter & React Native",
    headline: "Full Mobile Apps,",
    headlineAccent: "Launch Ready",
    subtitle: "Complete Flutter and React Native apps with backend, auth, and payments wired in.",
    cta: { label: "Shop Mobile Apps", href: "/categories/mobile-apps" },
    ctaSecondary: { label: "Free Previews", href: "/products" },
  },
] as const;

const FEATURED_PRODUCTS = [
  { name: "Next.js SaaS Starter Pro", price: "$79", originalPrice: "$129", badge: "Save 38%", image: "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=500&q=80&auto=format&fit=crop", category: "React & Next.js", featured: true, slug: "nextjs-saas-starter" },
  { name: "Admin Dashboard UI Kit", price: "$49", originalPrice: "$79", badge: "Best Seller", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&q=80&auto=format&fit=crop", category: "UI Kits", featured: false, slug: "admin-dashboard-ui" },
  { name: "WordPress Multi-Vendor Theme", price: "$65", originalPrice: null, badge: "New Release", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80&auto=format&fit=crop", category: "WordPress", featured: false, slug: "multi-vendor-wp-theme" },
  { name: "Flutter E-commerce App", price: "$89", originalPrice: "$119", badge: "Save 25%", image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=500&q=80&auto=format&fit=crop", category: "Mobile Apps", featured: false, slug: "flutter-ecom-app" },
  { name: "PHP Booking Script", price: "$35", originalPrice: "$50", badge: "Popular", image: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=500&q=80&auto=format&fit=crop", category: "PHP Scripts", featured: true, slug: "php-booking-script" },
  { name: "Vue 3 Component Library", price: "$39", originalPrice: null, badge: "Developer Pick", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&q=80&auto=format&fit=crop", category: "Vue.js", featured: false, slug: "vue3-components" },
  { name: "Landing Page Bundle (12 pack)", price: "$29", originalPrice: "$59", badge: "In Demand", image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=500&q=80&auto=format&fit=crop", category: "HTML Templates", featured: false, slug: "landing-bundle" },
  { name: "REST API Boilerplate (Node)", price: "$25", originalPrice: null, badge: "Starter", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&q=80&auto=format&fit=crop", category: "API & Backend", featured: false, slug: "node-api-boilerplate" },
  { name: "React Native Taxi App", price: "$95", originalPrice: "$149", badge: "Save 36%", image: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=500&q=80&auto=format&fit=crop", category: "Mobile", featured: false, slug: "rn-taxi-app" },
  { name: "Full SaaS + Stripe Starter", price: "$149", originalPrice: "$199", badge: "Premium", image: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=500&q=80&auto=format&fit=crop", category: "Full Apps", featured: true, slug: "saas-stripe-starter" },
] as const;

const SLIDE_INTERVAL = 6000;
const PRODUCT_INTERVAL = 5000;

const trustPills = [
  { label: "Instant digital download", icon: Download },
  { label: "Lifetime license included", icon: ShieldCheck },
  { label: "85% seller payout", icon: Zap },
  { label: "4.9★ Rated", icon: Star },
] as const;

export function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [productIdx, setProductIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrent(index);
      setTimeout(() => setIsTransitioning(false), 800);
    },
    [isTransitioning]
  );

  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length), [current, goTo]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [next, isPaused]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setProductIdx((i) => (i + 1) % FEATURED_PRODUCTS.length);
    }, PRODUCT_INTERVAL);
    return () => clearInterval(timer);
  }, [isPaused]);

  const slide = SLIDES[current];
  const product = FEATURED_PRODUCTS[productIdx];

  return (
    <section
      className="relative min-h-[420px] lg:min-h-[580px] overflow-hidden flex items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Hero slideshow"
    >
      {/* Background slideshow with Ken Burns */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-[1200ms] ease-in-out",
            i === current ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={i !== current}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image}
            alt={s.alt}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              i === current ? "animate-[kenburns_8s_ease-in-out_forwards]" : ""
            )}
          />
        </div>
      ))}

      {/* Overlays */}
      <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/55 to-black/25" />
      <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-linear-to-br from-(--brand-dark)/30 via-transparent to-(--brand-amber)/5" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 w-full">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
          {/* Left — text */}
          <div className="lg:col-span-7">
            <div
              key={`e-${current}`}
              className="inline-flex items-center gap-2 rounded-full bg-(--color-surface)/10 backdrop-blur-md border border-white/15 px-4 py-1.5 mb-6 animate-[fadeSlideUp_600ms_ease-out_both]"
            >
              <span className="h-2 w-2 rounded-full bg-(--brand-amber) animate-pulse" />
              <span className="text-xs font-medium text-white/90 tracking-wide">{slide.eyebrow}</span>
            </div>

            <h1
              key={`h-${current}`}
              className={cn(
                "font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl",
                "font-semibold text-white tracking-tight leading-[1.05]",
                "animate-[fadeSlideUp_700ms_ease-out_100ms_both]"
              )}
            >
              {slide.headline}
              <br className="hidden sm:block" />
              <span className="bg-linear-to-r from-(--brand-amber) to-amber-300 bg-clip-text text-transparent">
                {slide.headlineAccent}
              </span>
            </h1>

            <p
              key={`s-${current}`}
              className="text-base lg:text-lg text-white/70 mt-5 lg:mt-7 max-w-xl leading-relaxed animate-[fadeSlideUp_700ms_ease-out_200ms_both]"
            >
              {slide.subtitle}
            </p>

            <div
              key={`c-${current}`}
              className="mt-7 lg:mt-9 flex flex-col sm:flex-row gap-3 animate-[fadeSlideUp_700ms_ease-out_300ms_both]"
            >
              <Link
                href={slide.cta.href}
                className={cn(
                  "inline-flex items-center justify-center gap-2.5",
                  "bg-(--brand-amber) text-white",
                  "rounded-lg px-7 py-3.5 text-sm font-semibold",
                  "shadow-[0_8px_30px_rgba(232,134,26,0.4)]",
                  "transition-all duration-(--duration-base) ease-(--ease-premium)",
                  "hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(232,134,26,0.5)]",
                  "active:translate-y-0"
                )}
              >
                {slide.cta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={slide.ctaSecondary.href}
                prefetch={false}
                className={cn(
                  "inline-flex items-center justify-center",
                  "bg-(--color-surface)/10 backdrop-blur-sm border border-white/25 text-white",
                  "rounded-lg px-7 py-3.5 text-sm font-medium",
                  "transition-all duration-(--duration-base) ease-(--ease-premium)",
                  "hover:bg-(--color-surface)/20 hover:border-white/40"
                )}
              >
                {slide.ctaSecondary.label}
              </Link>
            </div>

            <div className="mt-10 lg:mt-14 flex flex-wrap gap-x-6 gap-y-2">
              {trustPills.map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-white/50">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Rotating Featured Product */}
          <div className="hidden lg:flex lg:col-span-5 justify-center">
            <div className="relative w-[360px]">
              <div
                className={cn(
                  "relative rounded-[24px]",
                  "bg-(--color-surface)/[0.08] backdrop-blur-2xl border border-white/[0.12]",
                  "p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
                  "animate-[float_6s_ease-in-out_infinite]"
                )}
              >
                <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden bg-(--color-surface)/5 mb-4">
                  {FEATURED_PRODUCTS.map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        "absolute inset-0 transition-all duration-700 ease-in-out",
                        i === productIdx
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-105"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                  ))}

                  <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                    <span className="bg-(--brand-amber) text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                      {product.badge}
                    </span>
                    {product.featured && (
                      <span className="bg-(--brand-primary) text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative min-h-[90px]">
                  {FEATURED_PRODUCTS.map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        "transition-all duration-500 ease-in-out",
                        i === productIdx
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-2 absolute inset-0 pointer-events-none"
                      )}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                        {p.category}
                      </span>
                      <h3 className="text-white font-semibold text-lg mt-0.5 leading-tight">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-mono text-2xl font-bold text-white">
                          {p.price}
                        </span>
                        {p.originalPrice && (
                          <span className="font-mono text-sm text-white/40 line-through">
                            {p.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href={`/products/${product.slug}`}
                  className={cn(
                    "mt-3 w-full flex items-center justify-center gap-2",
                    "bg-(--brand-amber) text-white rounded-[12px] py-2.5 text-sm font-semibold",
                    "shadow-[0_6px_20px_rgba(232,134,26,0.35)]",
                    "transition-all duration-200 ease-(--ease-premium)",
                    "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(232,134,26,0.45)]",
                    "active:translate-y-0"
                  )}
                >
                  <Download className="h-4 w-4" />
                  View Product
                </Link>
              </div>

              <div className="flex items-center justify-between mt-1.5 px-1">
                <div
                  className={cn(
                    "flex items-center gap-2.5",
                    "bg-(--color-surface) rounded-xl",
                    "px-4 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.2)]",
                    "animate-[float_8s_ease-in-out_infinite_reverse]"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-(--brand-primary-light) flex items-center justify-center">
                    <Code2 className="h-3.5 w-3.5 text-(--brand-primary)" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Instant Download</p>
                    <p className="text-[11px] text-(--color-text-muted)">Lifetime license</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {FEATURED_PRODUCTS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setProductIdx(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === productIdx
                          ? "w-5 bg-(--brand-amber)"
                          : "w-1.5 bg-(--color-surface)/30 hover:bg-(--color-surface)/50"
                      )}
                      aria-label={`View product ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "absolute -top-2 -right-4",
                  "flex items-center gap-1.5",
                  "bg-(--color-surface) rounded-full",
                  "px-3 py-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.2)]",
                  "animate-[float_7s_ease-in-out_infinite]"
                )}
              >
                <Star className="h-3.5 w-3.5 fill-(--brand-amber) text-(--brand-amber)" />
                <span className="text-xs font-bold text-foreground">4.9</span>
                <span className="text-[11px] text-(--color-text-muted)">(2.4k)</span>
              </div>

              <div
                className={cn(
                  "absolute top-1/2 -left-10",
                  "bg-(--color-surface) rounded-full",
                  "px-3 py-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.2)]",
                  "animate-[float_9s_ease-in-out_infinite]"
                )}
              >
                <span className="text-[11px] font-bold text-(--brand-primary)">10,000+</span>
                <span className="text-[11px] text-(--color-text-muted) ml-1">Products</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Controls */}
      <button
        onClick={prev}
        className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-(--color-surface)/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:bg-(--color-surface)/20 hover:text-white transition-all"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-(--color-surface)/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:bg-(--color-surface)/20 hover:text-white transition-all"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Progress dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
            style={{ width: i === current ? 32 : 8 }}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === current ? "true" : undefined}
          >
            <span className="absolute inset-0 bg-(--color-surface)/30 rounded-full" />
            {i === current && (
              <span
                className="absolute inset-0 bg-(--color-surface) rounded-full origin-left"
                style={{
                  animation: isPaused ? "none" : `progress ${SLIDE_INTERVAL}ms linear forwards`,
                }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-black/30 to-transparent z-10 pointer-events-none" />
    </section>
  );
}
