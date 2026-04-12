"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchProduct {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  thumbnail_url: string | null;
  category?: { name: string } | null;
}

interface GlobalSearchProps {
  variant?: "header" | "page";
  placeholder?: string;
}

export function GlobalSearch({
  variant = "header",
  placeholder = "Search for scripts, themes, templates...",
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(query)}&limit=6`
        );
        if (res.ok) {
          const json = await res.json();
          setResults(json.data ?? (Array.isArray(json) ? json : []));
        }
      } catch (e) {
        console.error("Search error:", e);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      router.push(`/products?search=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "relative flex items-center",
            variant === "header"
              ? "rounded-lg border border-(--color-border) bg-(--color-elevated) transition-all duration-(--duration-fast) focus-within:bg-(--color-surface) focus-within:border-(--brand-primary) focus-within:shadow-[0_0_0_3px_rgba(27,107,58,0.1)]"
              : "rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-sm)"
          )}
        >
          <Search className="absolute left-3.5 w-[17px] h-[17px] text-(--color-text-muted) pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className={cn(
              "w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-(--color-text-muted)",
              variant === "header" ? "pl-10 pr-16 py-2.5" : "pl-10 pr-16 py-3"
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-10 p-1 text-(--color-text-muted) hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="absolute right-3 hidden md:inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium text-(--color-text-muted) bg-(--color-surface) rounded-sm border border-(--color-border)">
            ⌘K
          </kbd>
        </div>
      </form>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-(--color-border) bg-(--color-surface) shadow-(--shadow-xl) overflow-hidden z-(--z-dropdown)">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-(--brand-primary)" />
            </div>
          ) : results.length > 0 ? (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {results.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setQuery("");
                        router.push(`/products/${product.slug}`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--color-elevated) transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-(--color-elevated) shrink-0">
                        {product.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.thumbnail_url}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-(--color-text-disabled)">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {product.title}
                        </p>
                        {product.category && (
                          <p className="text-xs text-(--color-text-muted)">
                            {product.category.name}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold font-mono text-foreground">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-(--color-border) px-4 py-2.5">
                <button
                  onClick={handleSubmit}
                  className="text-sm font-medium text-(--brand-primary) hover:underline"
                >
                  See all results for &ldquo;{query}&rdquo; →
                </button>
              </div>
            </>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center">
              <Package className="w-10 h-10 text-(--color-text-disabled) mx-auto mb-2" />
              <p className="text-sm text-(--color-text-muted)">
                No results for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
