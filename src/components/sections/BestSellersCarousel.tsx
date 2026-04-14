"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SellerTierBadge } from "@/components/seller/seller-tier-badge";
import type { SellerTier } from "@/lib/seller/tier";

export interface BestSellerProduct {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  rating?: number;
  reviewCount?: number;
  downloadCount?: number;
  category?: string | null;
  seller?: string | null;
  sellerTier?: SellerTier | null;
  isNew?: boolean;
  onSale?: boolean;
  isBestseller?: boolean;
}

interface BestSellersCarouselProps {
  products: BestSellerProduct[];
  title?: string;
  viewAllHref?: string;
}

export function BestSellersCarousel({
  products,
  title = "Best Sellers This Week",
  viewAllHref = "/products?sort=popular",
}: BestSellersCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const offset = direction === "left" ? -260 : 260;
    el.scrollBy({ left: offset, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="py-12 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--brand-primary) font-semibold mb-2">
              Trending now
            </p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold text-foreground">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={viewAllHref}
              className="text-sm text-(--brand-primary) hover:underline"
            >
              See all &rarr;
            </Link>
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={cn(
                "hidden md:flex items-center justify-center h-9 w-9 rounded-full border border-(--color-border)",
                "transition-opacity duration-(--duration-fast) ease-(--ease-premium)",
                !canScrollLeft && "opacity-40 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className={cn(
                "hidden md:flex items-center justify-center h-9 w-9 rounded-full border border-(--color-border)",
                "transition-opacity duration-(--duration-fast) ease-(--ease-premium)",
                !canScrollRight && "opacity-40 cursor-not-allowed"
              )}
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          >
            {products.map((product) => {
              const hasSale =
                product.compareAtPriceCents != null &&
                product.compareAtPriceCents > product.priceCents;

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="shrink-0 w-52 sm:w-56 lg:w-64 group"
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-(--color-elevated)">
                    {product.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.thumbnailUrl}
                        alt={product.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-(--ease-premium) group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-linear-to-br from-(--brand-primary)/20 to-(--brand-dark)/10" />
                    )}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      {product.isBestseller && (
                        <span className="rounded-full bg-(--brand-amber) text-white text-[11px] font-bold px-2 py-0.5 uppercase tracking-wide">
                          Bestseller
                        </span>
                      )}
                      {hasSale && (
                        <span className="rounded-full bg-(--color-sale) text-white text-[11px] font-bold px-2 py-0.5 uppercase tracking-wide">
                          Sale
                        </span>
                      )}
                      {product.isNew && (
                        <span className="rounded-full bg-(--brand-primary) text-white text-[11px] font-bold px-2 py-0.5 uppercase tracking-wide">
                          New
                        </span>
                      )}
                      {product.sellerTier && product.sellerTier !== "unverified" && (
                        <SellerTierBadge tier={product.sellerTier} size="avatar" />
                      )}
                    </div>
                  </div>

                  <div className="pt-3 space-y-1">
                    {product.category && (
                      <p className="text-[11px] uppercase tracking-wide text-(--color-text-muted)">
                        {product.category}
                      </p>
                    )}
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {product.title}
                    </p>
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="font-bold text-foreground">
                        ${(product.priceCents / 100).toFixed(2)}
                      </span>
                      {hasSale && (
                        <span className="text-xs text-(--color-text-muted) line-through">
                          ${(product.compareAtPriceCents! / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                      {product.rating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-(--brand-amber) text-(--brand-amber)" />
                          {product.rating.toFixed(1)}
                          {product.reviewCount != null && (
                            <span className="text-(--color-text-muted)">
                              ({product.reviewCount})
                            </span>
                          )}
                        </span>
                      )}
                      {product.downloadCount != null && (
                        <span className="flex items-center gap-0.5 text-(--color-text-muted)">
                          <Download className="h-3 w-3" />
                          {product.downloadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
