import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Microscope,
  GitBranch,
  ScrollText,
  Bug,
  Copy,
  Globe,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "How We Verify Code | CodeVault",
  description:
    "Every product on CodeVault is statically analyzed for quality, security vulnerabilities, and ownership authenticity. See exactly what we check — no AI guesses, real metrics.",
};

export default async function VerifyPage() {
  const stats = await loadHeadlineStats();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-(--brand-dark) text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(132,204,22,0.3),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(132,204,22,0.2),transparent_40%)]" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
          <span className="inline-flex items-center gap-2 border border-(--brand-amber)/30 bg-(--brand-amber)/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-(--brand-amber) font-semibold mb-6">
            <ShieldCheck className="h-3.5 w-3.5" />
            Our verification process
          </span>
          <h1 className="font-display text-4xl lg:text-6xl font-bold tracking-tight mb-5">
            Every line of code,
            <br />
            <span className="text-(--brand-amber)">measured before you buy.</span>
          </h1>
          <p className="text-lg lg:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            No reviews to game. No AI guesses. Real static analysis on every upload — the same way
            engineering teams vet production code.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-3xl lg:text-4xl font-bold tracking-tight">{s.value}</p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/50 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The three pillars */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-(--brand-primary) font-semibold mb-2">
              Three independent checks
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold">
              Quality, security, and ownership — all verified
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <PillarCard
              icon={Microscope}
              title="1. Code quality"
              tint="text-(--brand-primary)"
              items={[
                "Lines of code (source only, excluding blanks and comments)",
                "Language breakdown and file distribution",
                "Cyclomatic complexity per function (McCabe)",
                "Duplication ratio via sliding-window normalized hashing",
                "Test coverage detection across 9 frameworks",
                "Comment ratio and god-file detection",
              ]}
            />
            <PillarCard
              icon={Bug}
              title="2. Security"
              tint="text-red-600"
              items={[
                "Live CVE scan via OSV.dev on every dependency",
                "30+ dangerous-pattern sweeps (eval, SQL concat, innerHTML, weak crypto)",
                "Hardcoded secret detection (AKIA, AIza, sk_live, tokens)",
                "Transport-layer misconfiguration (rejectUnauthorized, CORS wildcards)",
                "Unsafe deserialization (pickle, yaml.load, unserialize)",
                "Top 25 vulnerabilities promoted to user-facing issues",
              ]}
            />
            <PillarCard
              icon={ShieldCheck}
              title="3. Ownership"
              tint="text-(--brand-amber)"
              items={[
                "Git authorship cross-checked against seller identity",
                "LICENSE classification (commercial-safe vs copyleft vs proprietary)",
                "Copyright header scan across every source file",
                "Obfuscation fingerprint (webpack sigils, minified walls)",
                "Internal fingerprint DB — catches re-uploads across sellers",
                "Public GitHub match via code search",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Grade table */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-(--brand-primary) font-semibold mb-2">
              How the grade is calculated
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold">
              A SonarQube-style score, simplified for buyers
            </h2>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-10">
            <GradeChip grade="A" range="85–100" label="Production-ready" color="bg-green-500" />
            <GradeChip grade="B" range="70–84" label="Solid" color="bg-lime-500" />
            <GradeChip grade="C" range="55–69" label="Usable" color="bg-amber-500" />
            <GradeChip grade="D" range="40–54" label="Needs work" color="bg-orange-500" />
            <GradeChip grade="F" range="0–39" label="Risky" color="bg-red-500" />
          </div>

          <div className="card p-8 rounded-none">
            <h3 className="font-semibold text-lg mb-4">Score components</h3>
            <ul className="space-y-3 text-sm text-(--color-text-secondary)">
              <Component label="Base" detail="Start at 100" />
              <Component label="Complexity" detail="Penalty scales with % of functions over McCabe 10" />
              <Component label="Duplication" detail="Penalty scales with duplicated-line ratio" />
              <Component label="Tests" detail="Bonus when test files + recognized framework are present" />
              <Component label="Security" detail="Subtract per critical/major issue and per vulnerable dependency" />
              <Component label="Structure" detail="Penalty for god-files and unusually deep hierarchies" />
            </ul>
            <p className="text-xs text-(--color-text-muted) italic mt-6 pt-4 border-t">
              Ownership authenticity is scored separately (0–100) and rendered as a shield verdict
              — Verified, No concerns, Unclear, or Likely stolen.
            </p>
          </div>
        </div>
      </section>

      {/* Ownership verdict ladder */}
      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-(--brand-amber) font-semibold mb-2">
              Stolen code stops at the door
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold">
              Six independent ownership signals
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <OwnershipRow icon={GitBranch} label="Git authorship" detail="We compare committer emails and names in .git/ against the seller's verified identity." />
            <OwnershipRow icon={ScrollText} label="License classification" detail="AGPL, GPL, and CC-NC block resale. MIT/Apache/BSD pass. 'All rights reserved' flags proprietary." />
            <OwnershipRow icon={ScrollText} label="Copyright headers" detail="We read the first 60 lines of every source file. Four or more distinct holders triggers a warning." />
            <OwnershipRow icon={Copy} label="Internal fingerprint match" detail="SHA-256 hashes of every source file are compared against every other seller's uploads." />
            <OwnershipRow icon={Globe} label="Public GitHub match" detail="Distinctive names and dependencies are searched against public GitHub repos." />
            <OwnershipRow icon={Sparkles} label="Obfuscation detection" detail="Minified walls, hex dumps, and webpack sigils are flagged as repackaging attempts." />
          </div>

          <p className="text-center text-sm text-(--color-text-muted) mt-8 italic">
            Any single critical signal — a fingerprint match, a copyleft license, or heavy
            obfuscation — is enough to mark a product as <strong className="text-red-700 not-italic">Likely stolen</strong>.
          </p>
        </div>
      </section>

      {/* What you see on every product */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-(--brand-primary) font-semibold mb-3">
                Full transparency
              </p>
              <h2 className="font-display text-3xl lg:text-4xl font-bold mb-5">
                See the report before you spend a dollar
              </h2>
              <p className="text-(--color-text-secondary) leading-relaxed mb-6">
                Every product page links to the full analysis: metrics, language breakdown,
                complexity offenders, duplicate blocks, vulnerability list, and ownership
                verdict. Nothing is hidden behind a paywall.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-(--brand-primary) text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-(--brand-primary)/90 transition"
              >
                Browse verified products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="card rounded-none p-6 bg-white">
              <ul className="space-y-3 text-sm">
                <Checkline text="Quality grade A–F with score breakdown" />
                <Checkline text="Every metric we measured, with raw numbers" />
                <Checkline text="Every CVE and every red-flag pattern, linked" />
                <Checkline text="Ownership verdict with full evidence list" />
                <Checkline text="Fair-price suggestion based on measured quality" />
                <Checkline text="Updated on every seller upload — no stale reports" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What we don't do */}
      <section className="py-16 lg:py-20 border-t">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl lg:text-3xl font-bold mb-4">What we don&apos;t do</h2>
          <p className="text-(--color-text-secondary) leading-relaxed mb-6">
            We don&apos;t use AI to &quot;estimate&quot; code value. We don&apos;t fabricate download
            counts, ratings, or marketing numbers. If a metric can&apos;t be measured from the
            actual source files, we don&apos;t show it.
          </p>
          <p className="text-sm text-(--color-text-muted)">
            All analysis runs server-side on the uploaded archive — before the product is ever
            listed publicly.
          </p>
        </div>
      </section>
    </div>
  );
}

type HeadlineStat = { value: string; label: string };

async function loadHeadlineStats(): Promise<HeadlineStat[]> {
  const supabase = getSupabaseAdmin();
  const [scannedRes, locRes, stolenRes, cveRes] = await Promise.all([
    supabase
      .from("product_analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("product_analyses").select("total_loc").eq("status", "completed"),
    supabase
      .from("product_ownership_checks")
      .select("*", { count: "exact", head: true })
      .eq("verdict", "stolen"),
    supabase
      .from("product_analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gt("issue_count", 0),
  ]);

  const totalLoc = (locRes.data ?? []).reduce((s, r) => s + (r.total_loc ?? 0), 0);

  return [
    { value: compact(scannedRes.count ?? 0), label: "Products scanned" },
    { value: compact(totalLoc), label: "Lines analyzed" },
    { value: compact(stolenRes.count ?? 0), label: "Stolen code blocked" },
    { value: compact(cveRes.count ?? 0), label: "Reports with issues" },
  ];
}

function compact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.floor(n / 1000) + "K";
  if (n < 10_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return Math.floor(n / 1_000_000) + "M";
}

function PillarCard({
  icon: Icon,
  title,
  tint,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint: string;
  items: string[];
}) {
  return (
    <div className="card rounded-none p-6 h-full">
      <Icon className={`h-8 w-8 ${tint} mb-4`} />
      <h3 className="font-display text-xl font-bold mb-4">{title}</h3>
      <ul className="space-y-2 text-sm text-(--color-text-secondary)">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <CheckCircle2 className={`h-4 w-4 ${tint} shrink-0 mt-0.5`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GradeChip({
  grade,
  range,
  label,
  color,
}: {
  grade: string;
  range: string;
  label: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div
        className={`${color} text-white font-display text-4xl font-black h-20 flex items-center justify-center mb-2`}
      >
        {grade}
      </div>
      <p className="text-xs font-semibold">{range}</p>
      <p className="text-[11px] text-(--color-text-muted)">{label}</p>
    </div>
  );
}

function Component({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="font-semibold text-(--color-text-primary) min-w-[110px]">{label}</span>
      <span>{detail}</span>
    </li>
  );
}

function OwnershipRow({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
}) {
  return (
    <div className="card rounded-none p-5 flex gap-4">
      <div className="h-10 w-10 bg-(--brand-primary)/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-(--brand-primary)" />
      </div>
      <div>
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function Checkline({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-(--brand-primary) shrink-0 mt-0.5" />
      <span className="text-(--color-text-secondary)">{text}</span>
    </li>
  );
}
