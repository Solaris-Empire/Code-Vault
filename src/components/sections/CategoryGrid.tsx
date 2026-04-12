import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  name: string;
  slug: string;
  imageUrl?: string;
  icon?: string | null;
  itemCount?: number;
}

interface CategoryGridProps {
  categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  const tiles = categories.slice(0, 8);

  return (
    <section className="py-12 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-(--brand-primary) text-sm font-semibold tracking-wider uppercase mb-2 block">
              Explore
            </span>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold text-foreground">
              Browse Categories
            </h2>
          </div>
          <Link
            href="/categories"
            className="text-sm font-medium text-(--brand-primary) hover:underline"
          >
            View all &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          {tiles.map((category, index) => (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="reveal-up stagger-child group relative overflow-hidden rounded-xl aspect-[4/3]"
              style={{ "--delay": `${index * 80}ms` } as React.CSSProperties}
            >
              {category.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover",
                    "transition-transform duration-500 ease-(--ease-premium)",
                    "group-hover:scale-[1.08]"
                  )}
                />
              ) : (
                <div className="absolute inset-0 bg-linear-to-br from-(--brand-primary) to-(--brand-dark) flex items-center justify-center">
                  {category.icon && (
                    <span className="text-5xl opacity-30">{category.icon}</span>
                  )}
                </div>
              )}

              <div
                className={cn(
                  "absolute inset-0",
                  "bg-linear-to-t from-black/70 via-black/30 to-transparent",
                  "transition-colors duration-(--duration-base)",
                  "group-hover:from-black/80"
                )}
              />

              <div className="absolute bottom-0 left-0 right-0 p-3 lg:p-4 flex items-end justify-between">
                <div>
                  <span className="text-sm lg:text-base font-semibold text-white block">
                    {category.name}
                  </span>
                  {category.itemCount != null && (
                    <span className="text-xs text-white/70">
                      {category.itemCount}+ items
                    </span>
                  )}
                </div>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 text-white/0 shrink-0",
                    "transition-all duration-(--duration-base) ease-(--ease-premium)",
                    "group-hover:text-white/80 group-hover:translate-x-1"
                  )}
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
