import Link from "next/link";
import { ArrowRight, Download, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SellerTierBadge } from "@/components/seller/seller-tier-badge";
import type { SellerTier } from "@/lib/seller/tier";

export interface ShowcaseProduct {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  seller?: string | null;
  sellerTier?: SellerTier | null;
  category?: string | null;
  rating?: number;
  downloadCount?: number;
  isFeatured?: boolean;
}

interface ProductShowcaseProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  products: ShowcaseProduct[];
  layout?: "scroll" | "grid";
  columns?: 3 | 4 | 5 | 6;
  badgeText?: string;
  badgeColor?: string;
}

function ProductCard({
  product,
  badgeText,
  badgeColor,
}: {
  product: ShowcaseProduct;
  badgeText?: string;
  badgeColor?: string;
}) {
  const hasSale =
    product.compareAtPriceCents != null &&
    product.compareAtPriceCents > product.priceCents;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "group rounded-2xl border border-(--color-border) bg-(--color-surface) overflow-hidden flex flex-col",
        "hover:-translate-y-1 hover:shadow-(--shadow-lg) transition-all duration-300"
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-(--color-elevated)">
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

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {badgeText && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wide",
                badgeColor ?? "bg-(--brand-primary)"
              )}
            >
              {badgeText}
            </span>
          )}
          {product.isFeatured && !badgeText && (
            <span className="rounded-full bg-(--brand-amber) text-white text-[11px] font-bold px-2.5 py-0.5 uppercase tracking-wide">
              Featured
            </span>
          )}
          {hasSale && (
            <span className="rounded-full bg-(--color-sale) text-white text-[11px] font-bold px-2.5 py-0.5 uppercase tracking-wide">
              Sale
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-1.5 flex-1">
        {product.category && (
          <p className="text-[11px] uppercase tracking-wider text-(--color-text-muted)">
            {product.category}
          </p>
        )}
        <p className="text-sm font-semibold text-foreground line-clamp-2 flex-1">
          {product.title}
        </p>
        {product.seller && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-(--color-text-muted)">by {product.seller}</p>
            {product.sellerTier && product.sellerTier !== "unverified" && (
              <SellerTierBadge tier={product.sellerTier} size="avatar" />
            )}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-(--color-border)">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-base font-bold text-foreground">
              ${(product.priceCents / 100).toFixed(2)}
            </span>
            {hasSale && (
              <span className="font-mono text-xs text-(--color-text-muted) line-through">
                ${(product.compareAtPriceCents! / 100).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
            {product.rating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-(--brand-amber) text-(--brand-amber)" />
                {product.rating.toFixed(1)}
              </span>
            )}
            {product.downloadCount != null && (
              <span className="flex items-center gap-0.5">
                <Download className="h-3 w-3" />
                {product.downloadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

const COLUMN_MAP: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function ProductShowcase({
  title,
  subtitle,
  viewAllHref,
  products,
  layout = "scroll",
  columns = 4,
  badgeText,
  badgeColor,
}: ProductShowcaseProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-10 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-(--color-text-secondary) mt-1">
                {subtitle}
              </p>
            )}
          </div>

          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="flex items-center gap-1 text-sm font-medium text-(--brand-primary) hover:underline shrink-0"
            >
              See all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {layout === "scroll" ? (
          <div className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {products.map((product) => (
              <div key={product.id} className="shrink-0 w-64 sm:w-72">
                <ProductCard product={product} badgeText={badgeText} badgeColor={badgeColor} />
              </div>
            ))}
          </div>
        ) : (
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4", COLUMN_MAP[columns])}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                badgeText={badgeText}
                badgeColor={badgeColor}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
