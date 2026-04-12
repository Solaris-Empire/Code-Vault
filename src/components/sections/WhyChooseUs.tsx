import {
  Zap,
  Code2,
  BadgeDollarSign,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
  stat: string;
}[] = [
  {
    icon: Zap,
    title: "Instant Delivery",
    description: "Download your code the second payment clears. No waiting, no email delays.",
    stat: "<10s",
  },
  {
    icon: Code2,
    title: "Vetted Code Quality",
    description: "Every product is reviewed by our team. Clean code, documented, production-ready.",
    stat: "100% reviewed",
  },
  {
    icon: BadgeDollarSign,
    title: "Sellers Keep 85%",
    description: "Industry-lowest 15% platform fee. Authors earn more, so quality stays high.",
    stat: "85% payout",
  },
  {
    icon: RefreshCw,
    title: "Free Lifetime Updates",
    description: "Every new version included in your purchase. Bug fixes, features, forever.",
    stat: "Forever",
  },
  {
    icon: ShieldCheck,
    title: "Secure Licensing",
    description: "Unique license key per purchase. Regular and extended licenses available.",
    stat: "256-bit SSL",
  },
  {
    icon: MessageCircle,
    title: "Direct Author Support",
    description: "Chat directly with the author who built it. Average response: under 4 hours.",
    stat: "<4 hr",
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-16 lg:py-24 bg-(--color-surface)">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-center">
          <div className="hidden lg:block lg:col-span-5">
            <div className="relative rounded-3xl overflow-hidden aspect-3/4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80&auto=format&fit=crop"
                alt="Developer at work"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 bg-(--color-surface)/95 backdrop-blur-md rounded-2xl p-5 shadow-(--shadow-lg)">
                <p className="font-display text-lg font-semibold text-foreground">
                  Trusted by 50,000+ developers
                </p>
                <p className="text-sm text-(--color-text-muted) mt-1">
                  Rated 4.9/5 across all products
                </p>
                <div className="flex items-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg
                      key={i}
                      className="h-4 w-4 text-amber-400 fill-amber-400"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.2em] text-(--brand-primary) font-semibold mb-3">
              Why CodeVault
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold text-foreground leading-tight">
              The code marketplace{" "}
              <span className="text-(--brand-primary)">built for builders</span>
            </h2>
            <p className="text-base text-(--color-text-secondary) mt-3 max-w-lg leading-relaxed">
              We're not just another code bazaar. Every detail — from licensing to payout — is designed for
              developers who want to ship, not shop around.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group flex gap-4 p-4 rounded-xl hover:bg-(--color-elevated) transition-colors duration-200"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--brand-primary)/8 group-hover:bg-(--brand-primary)/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-(--brand-primary)" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <span className="text-[11px] font-bold text-(--brand-primary) bg-(--brand-primary)/8 px-1.5 py-0.5 rounded">
                        {feature.stat}
                      </span>
                    </div>
                    <p className="text-xs text-(--color-text-muted) mt-1 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
