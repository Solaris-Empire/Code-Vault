import { getSupabaseAdmin } from "@/lib/supabase/server";
import { HeroSection } from "@/components/sections/HeroSection";
import { TrustBar } from "@/components/sections/TrustBar";
import { CategoryGrid } from "@/components/sections/CategoryGrid";
import { BrandsMarquee } from "@/components/sections/BrandsMarquee";
import {
  BestSellersCarousel,
  type BestSellerProduct,
} from "@/components/sections/BestSellersCarousel";
import {
  ProductShowcase,
  type ShowcaseProduct,
} from "@/components/sections/ProductShowcase";
import { StatsBar } from "@/components/sections/StatsBar";
import { WhyChooseUs } from "@/components/sections/WhyChooseUs";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { NewsletterSignup } from "@/components/sections/NewsletterSignup";

export const revalidate = 60;

import type { SellerTier } from "@/lib/seller/tier";

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  price_cents: number;
  avg_rating: number | null;
  review_count: number | null;
  download_count: number | null;
  is_featured: boolean | null;
  created_at: string | null;
  seller: { display_name: string | null; seller_tier: SellerTier | null } | null;
  category: { name: string | null; slug: string | null } | null;
};

function toShowcaseProduct(p: ProductRow): ShowcaseProduct {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    thumbnailUrl: p.thumbnail_url,
    priceCents: p.price_cents,
    seller: p.seller?.display_name ?? null,
    sellerTier: p.seller?.seller_tier ?? null,
    category: p.category?.name ?? null,
    rating: p.avg_rating ?? undefined,
    downloadCount: p.download_count ?? undefined,
    isFeatured: p.is_featured ?? false,
  };
}

function toBestSeller(p: ProductRow): BestSellerProduct {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    thumbnailUrl: p.thumbnail_url,
    priceCents: p.price_cents,
    category: p.category?.name ?? null,
    seller: p.seller?.display_name ?? null,
    sellerTier: p.seller?.seller_tier ?? null,
    rating: p.avg_rating ?? undefined,
    reviewCount: p.review_count ?? undefined,
    downloadCount: p.download_count ?? undefined,
    isBestseller: true,
  };
}

const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  "php-scripts":
    "https://images.unsplash.com/photo-1599507593499-a3f7d7d97667?w=800&q=80&auto=format&fit=crop",
  javascript:
    "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800&q=80&auto=format&fit=crop",
  "react-nextjs":
    "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80&auto=format&fit=crop",
  "vue-js":
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80&auto=format&fit=crop",
  "wordpress-themes":
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80&auto=format&fit=crop",
  "wordpress-plugins":
    "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80&auto=format&fit=crop",
  "html-templates":
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&q=80&auto=format&fit=crop",
  "mobile-apps":
    "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=80&auto=format&fit=crop",
  "full-applications":
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80&auto=format&fit=crop",
  "ui-kits":
    "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800&q=80&auto=format&fit=crop",
  "api-backend":
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80&auto=format&fit=crop",
  "database-tools":
    "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&q=80&auto=format&fit=crop",
};

export default async function HomePage() {
  const supabase = getSupabaseAdmin();

  const productSelect = `
    id, title, slug, thumbnail_url, price_cents, avg_rating, review_count,
    download_count, is_featured, created_at,
    seller:users!products_seller_id_fkey(display_name, seller_tier),
    category:categories(name, slug)
  `;

  const [categoriesRes, featuredRes, latestRes, popularRes] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select(productSelect)
      .eq("status", "approved")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("products")
      .select(productSelect)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("products")
      .select(productSelect)
      .eq("status", "approved")
      .order("download_count", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  const categoriesRaw = categoriesRes.data ?? [];
  const featured = (featuredRes.data ?? []) as unknown as ProductRow[];
  const latest = (latestRes.data ?? []) as unknown as ProductRow[];
  const popular = (popularRes.data ?? []) as unknown as ProductRow[];

  const categoryTiles = categoriesRaw.slice(0, 8).map((c) => ({
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    imageUrl: CATEGORY_IMAGE_FALLBACKS[c.slug] ?? undefined,
  }));

  return (
    <>
      <HeroSection />

      <TrustBar />

      {categoryTiles.length > 0 && <CategoryGrid categories={categoryTiles} />}

      <BrandsMarquee />

      {popular.length > 0 && (
        <BestSellersCarousel
          products={popular.map(toBestSeller)}
          title="Best Sellers This Week"
          viewAllHref="/products?sort=popular"
        />
      )}

      {featured.length > 0 && (
        <ProductShowcase
          title="Hand-picked Featured"
          subtitle="Curated by our team — top-rated products worth your time"
          viewAllHref="/products?featured=true"
          products={featured.map(toShowcaseProduct)}
          layout="grid"
          columns={4}
          badgeText="Featured"
          badgeColor="bg-(--brand-amber)"
        />
      )}

      <StatsBar />

      {latest.length > 0 && (
        <ProductShowcase
          title="Fresh Releases"
          subtitle="Just uploaded by our authors this week"
          viewAllHref="/products?sort=new"
          products={latest.map(toShowcaseProduct)}
          layout="scroll"
          badgeText="New"
          badgeColor="bg-(--brand-primary)"
        />
      )}

      <WhyChooseUs />

      <TestimonialsSection />

      <NewsletterSignup />
    </>
  );
}
