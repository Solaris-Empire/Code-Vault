"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  { name: "Sarah Chen", role: "Indie Hacker", rating: 5, quote: "Shipped my SaaS in a weekend thanks to the Next.js starter I grabbed here. The code was clean and the docs were actually good." },
  { name: "Marcus Webb", role: "Freelance Developer", rating: 5, quote: "I've bought from every major code marketplace. CodeVault's quality review is the real difference — I don't waste hours refactoring." },
  { name: "Priya Sharma", role: "Startup CTO", rating: 5, quote: "Saved us $40k in dev costs. Bought the admin dashboard UI kit and had a working MVP in 3 days instead of 3 months." },
  { name: "David Rodriguez", role: "Agency Owner", rating: 5, quote: "As a seller, the 85% payout is a no-brainer. I moved all my products here from competitors — earnings doubled." },
  { name: "Emma Thompson", role: "Full-stack Engineer", rating: 5, quote: "The license system is proper. Regular and extended licenses explained clearly, no legal guesswork like on other sites." },
  { name: "Mohammed Al-Hassan", role: "WordPress Developer", rating: 5, quote: "Best WordPress theme marketplace I've used. Direct chat with the author got my support question answered in 30 minutes." },
  { name: "Rachel Hughes", role: "Mobile Developer", rating: 5, quote: "Flutter templates here are legit production-ready. Not the usual half-finished demos. Saved me weeks on my last client project." },
  { name: "Tom Wilson", role: "Solopreneur", rating: 4, quote: "The free lifetime updates policy is huge. Bought a Laravel boilerplate last year and still getting patches from the author." },
  { name: "Lucy Fernandez", role: "React Developer", rating: 5, quote: "The React component libraries here are a masterclass in Tailwind. I've learned as much from reading the code as I have from using it." },
  { name: "Chen Liu", role: "Technical Lead", rating: 5, quote: "We vet every dependency. CodeVault products pass our security review more often than any other marketplace. That's saying something." },
  { name: "Olivia Nakamura", role: "Designer & Developer", rating: 5, quote: "The UI kits are beautifully coded — not just pretty screenshots. Every component is production-ready and accessible out of the box." },
  { name: "Patrick Byrne", role: "Indie Developer", rating: 5, quote: "Bought a Stripe integration boilerplate. Worked first try, even with Connect. That never happens. Got my $29 back in saved hours instantly." },
  { name: "Aisha Khan", role: "Node.js Developer", rating: 5, quote: "The Node API boilerplate here has auth, Stripe, emails, and tests already wired up. Would've taken me a month to build from scratch." },
  { name: "George Martin", role: "Seller", rating: 5, quote: "Got my first sale within 48 hours of publishing. The discovery is good — quality products get seen, not buried in page 47." },
  { name: "Sophie Davies", role: "Frontend Developer", rating: 4, quote: "Love that every product has a demo link. I never buy blind anymore. You can feel the quality before committing." },
  { name: "Ryan Park", role: "Backend Engineer", rating: 5, quote: "Switched from CodeCanyon six months ago as a buyer. The code quality here is noticeably higher. Worth every penny." },
  { name: "Hannah Jordan", role: "Vue.js Developer", rating: 5, quote: "The community reviews are genuine. You can tell the difference between real developers and bots. Helps me pick winners fast." },
  { name: "Michael Scott", role: "CTO", rating: 5, quote: "Extended license pricing is fair. We've used CodeVault code in 12 client projects — way cheaper than building from scratch every time." },
  { name: "Fatima Zahra", role: "PHP Developer", rating: 5, quote: "Finally a marketplace that takes code quality seriously. I can recommend products to my junior devs without worrying about bad patterns." },
  { name: "William Cooper", role: "Full-stack Developer", rating: 5, quote: "The search and filtering is excellent. Found exactly the TypeScript boilerplate I needed in under a minute. Competitors take forever." },
] as const;

const VISIBLE_COUNT = 3;
const INTERVAL = 5000;

export function TestimonialsSection() {
  const [startIndex, setStartIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const totalSets = Math.ceil(TESTIMONIALS.length / VISIBLE_COUNT);

  const next = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setStartIndex((prev) => (prev + VISIBLE_COUNT) % TESTIMONIALS.length);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const prev = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setStartIndex(
      (prev) => (prev - VISIBLE_COUNT + TESTIMONIALS.length) % TESTIMONIALS.length
    );
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  useEffect(() => {
    const timer = setInterval(next, INTERVAL);
    return () => clearInterval(timer);
  }, [next]);

  const visibleTestimonials = Array.from({ length: VISIBLE_COUNT }, (_, i) =>
    TESTIMONIALS[(startIndex + i) % TESTIMONIALS.length]
  );

  const currentSet = Math.floor(startIndex / VISIBLE_COUNT);

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--brand-primary) font-semibold mb-2">
              Testimonials
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold text-foreground">
              Loved by builders everywhere
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-(--color-surface) border border-(--color-border) rounded-full px-4 py-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-foreground">4.9/5</span>
              <span className="text-xs text-(--color-text-muted)">
                12,000+ reviews
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={prev}
                className="h-9 w-9 rounded-full border border-(--color-border) flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-elevated) hover:text-foreground transition-colors"
                aria-label="Previous testimonials"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={next}
                className="h-9 w-9 rounded-full border border-(--color-border) flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-elevated) hover:text-foreground transition-colors"
                aria-label="Next testimonials"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          {visibleTestimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.name}-${startIndex}`}
              className={cn(
                "rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 lg:p-7",
                "transition-all duration-500",
                isTransitioning
                  ? "opacity-0 translate-y-3"
                  : "opacity-100 translate-y-0"
              )}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <Quote className="h-8 w-8 text-(--brand-primary)/15 mb-3" />

              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: testimonial.rating }, (_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
                {Array.from({ length: 5 - testimonial.rating }, (_, i) => (
                  <Star
                    key={`e-${i}`}
                    className="h-4 w-4 fill-(--color-border) text-(--color-border)"
                  />
                ))}
              </div>

              <blockquote className="text-sm text-(--color-text-secondary) leading-relaxed min-h-18">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="mt-5 flex items-center gap-3 pt-4 border-t border-(--color-border)/50">
                <div className="h-9 w-9 rounded-full bg-(--brand-dark) flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {testimonial.name}
                  </p>
                  <p className="text-[11px] text-(--color-text-muted)">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-8">
          {Array.from({ length: totalSets }, (_, i) => (
            <button
              key={i}
              onClick={() => {
                setStartIndex(i * VISIBLE_COUNT);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentSet
                  ? "w-6 bg-(--brand-primary)"
                  : "w-1.5 bg-(--color-border)"
              )}
              aria-label={`Go to testimonial set ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
