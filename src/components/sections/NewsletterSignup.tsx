"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle,
  Sparkles,
  Gift,
  Percent,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FormState = "idle" | "loading" | "done" | "error";

const PERKS = [
  { icon: Percent, text: "10% off your first purchase" },
  { icon: Gift, text: "Exclusive member-only product drops" },
  { icon: Bell, text: "New release alerts & seller tips" },
] as const;

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
          <div className="lg:grid lg:grid-cols-2">
            <div className="bg-(--brand-dark) p-8 sm:p-10 lg:p-14 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full border border-white/5" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full border border-white/5" />
              <div className="absolute top-1/2 right-0 w-32 h-32 rounded-full bg-(--brand-primary)/15 blur-3xl" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 mb-6">
                  <Sparkles className="h-3.5 w-3.5 text-(--brand-amber)" />
                  <span className="text-xs font-semibold text-white/80">
                    Join the vault
                  </span>
                </div>

                <h2 className="font-display text-3xl lg:text-4xl font-semibold text-white leading-tight">
                  Don&apos;t miss
                  <br />
                  <span className="text-(--brand-amber)">new releases</span>
                </h2>

                <p className="mt-4 text-sm text-white/50 leading-relaxed max-w-sm">
                  50,000+ developers already get our weekly drops, seller tips,
                  and exclusive discounts.
                </p>

                <div className="mt-8 space-y-3">
                  {PERKS.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <Icon className="h-4 w-4 text-(--brand-amber)" />
                      </div>
                      <span className="text-sm text-white/70">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
              {state !== "done" ? (
                <>
                  <h3 className="font-display text-2xl font-semibold text-foreground">
                    Get your discount code
                  </h3>
                  <p className="mt-2 text-sm text-(--color-text-muted)">
                    Enter your email and we&apos;ll send a 10% discount code for your first purchase.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                    <div>
                      <label
                        htmlFor="newsletter-email"
                        className="text-xs font-medium text-(--color-text-secondary) mb-1.5 block"
                      >
                        Email address
                      </label>
                      <input
                        id="newsletter-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={cn(
                          "w-full h-12 rounded-xl",
                          "border border-(--color-border) bg-background",
                          "px-4 text-sm text-foreground placeholder:text-(--color-text-muted)",
                          "focus:border-(--brand-primary) focus:ring-2 focus:ring-(--brand-primary)/30",
                          "outline-none transition-all duration-200"
                        )}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={state === "loading"}
                      className={cn(
                        "w-full inline-flex items-center justify-center gap-2",
                        "h-12 rounded-xl",
                        "bg-(--brand-amber) text-white text-sm font-semibold",
                        "shadow-[0_6px_20px_rgba(232,134,26,0.25)]",
                        "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(232,134,26,0.35)]",
                        "transition-all duration-200",
                        "disabled:opacity-60"
                      )}
                    >
                      {state === "loading" ? "Sending..." : "Get My 10% Discount"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  {state === "error" && (
                    <p className="mt-2 text-xs text-(--color-error)">
                      Something went wrong. Please try again.
                    </p>
                  )}

                  <p className="mt-4 text-[11px] text-(--color-text-muted)">
                    No spam, ever. Unsubscribe with one click.
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="h-14 w-14 rounded-full bg-(--color-success)/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-7 w-7 text-(--color-success)" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    You&apos;re in!
                  </h3>
                  <p className="mt-2 text-sm text-(--color-text-muted)">
                    Check your inbox for your 10% discount code.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
