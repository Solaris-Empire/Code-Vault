import { ScanLine, FileCode2, ShieldX, Banknote, Download, ShieldCheck, RotateCcw, MessageCircle } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Real platform counters. No fake numbers — if the DB returns 0, we show 0.
// Rendered from a server component; parent `page.tsx` has revalidate = 60.

type Stat = { value: string; label: string; icon: React.ComponentType<{ className?: string }> };

const TRUST = [
  { icon: Download, title: "Instant downloads" },
  { icon: ShieldCheck, title: "Code quality checked" },
  { icon: RotateCcw, title: "Free lifetime updates" },
  { icon: MessageCircle, title: "24/7 author support" },
] as const;

export async function StatsBar() {
  const stats = await loadStats();

  return (
    <section className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1920&q=80&auto=format&fit=crop"
        alt="Developer workspace"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-(--brand-dark)/90 backdrop-blur-sm" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-10 lg:mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-(--brand-amber) font-semibold mb-2">
            Verified in real time
          </p>
          <h2 className="font-display text-2xl lg:text-3xl font-bold text-white">
            Every number below is measured, not marketed
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-white/10">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center lg:px-8">
              <stat.icon className="h-6 w-6 text-(--brand-amber) mx-auto mb-3" />
              <p className="font-display text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs uppercase tracking-[0.15em] text-white/40 mt-2 font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="my-10 lg:my-14 border-t border-white/10" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {TRUST.map(({ icon: Icon, title }) => (
            <div key={title} className="flex items-center gap-3 justify-center">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-(--brand-amber)" />
              </div>
              <span className="text-sm font-medium text-white/70">{title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function loadStats(): Promise<Stat[]> {
  const supabase = getSupabaseAdmin();

  const [scannedRes, locRes, stolenRes, paidRes] = await Promise.all([
    supabase
      .from("product_analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("product_analyses")
      .select("total_loc")
      .eq("status", "completed"),
    supabase
      .from("product_ownership_checks")
      .select("*", { count: "exact", head: true })
      .eq("verdict", "stolen"),
    supabase
      .from("orders")
      .select("seller_payout_cents")
      .eq("status", "completed"),
  ]);

  const scannedCount = scannedRes.count ?? 0;
  const totalLoc = (locRes.data ?? []).reduce(
    (sum, row) => sum + (row.total_loc ?? 0),
    0,
  );
  const stolenBlocked = stolenRes.count ?? 0;
  const paidOutCents = (paidRes.data ?? []).reduce(
    (sum, row) => sum + (row.seller_payout_cents ?? 0),
    0,
  );

  return [
    { value: formatCompact(scannedCount), label: "Products scanned", icon: ScanLine },
    { value: formatCompact(totalLoc), label: "Lines analyzed", icon: FileCode2 },
    { value: formatCompact(stolenBlocked), label: "Stolen code blocked", icon: ShieldX },
    { value: formatMoney(paidOutCents), label: "Paid to sellers", icon: Banknote },
  ];
}

// 1_234 → "1.2K", 12_345 → "12K", 1_200_000 → "1.2M". No fake padding.
function formatCompact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.floor(n / 1000) + "K";
  if (n < 10_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n < 1_000_000_000) return Math.floor(n / 1_000_000) + "M";
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 1000) return "$" + dollars.toFixed(0);
  return "$" + formatCompact(Math.floor(dollars));
}
