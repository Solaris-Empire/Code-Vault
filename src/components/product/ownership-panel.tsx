// Ownership & authenticity panel — Phase 4.
// Pure presentation. Reads from public.product_ownership_checks.

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  BadgeCheck,
  ScrollText,
  GitCommit,
  FileSignature,
  EyeOff,
  Globe,
  Copy,
  Loader2,
} from 'lucide-react'
import type { OwnershipSignal, OwnershipSignalStrength, OwnershipVerdict } from '@/lib/analysis/ownership'

export interface OwnershipRow {
  verdict: OwnershipVerdict
  authenticity_score: number
  license_name: string | null
  license_classification: string | null
  license_allows_resale: boolean | null
  git_present: boolean
  git_unique_authors: number
  git_matches_seller: boolean
  copyright_holders_count: number
  obfuscated_file_count: number
  fingerprint_matches: number
  github_match_count: number
  signals: OwnershipSignal[] | null
  updated_at: string
}

interface OwnershipPanelProps {
  ownership: OwnershipRow | null
  /** Show the long signal list. Defaults to true on full page, false on compact. */
  expanded?: boolean
}

export function OwnershipPanel({ ownership, expanded = false }: OwnershipPanelProps) {
  if (!ownership) {
    return (
      <div className="card rounded-none p-6">
        <div className="flex items-center gap-2 mb-2">
          <BadgeCheck className="h-5 w-5 text-(--brand-primary)" />
          <h2 className="text-xl font-bold">Ownership &amp; Authenticity</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ownership check is still running. Refresh in a moment.
        </div>
      </div>
    )
  }

  const v = verdictStyles(ownership.verdict)
  const signals = ownership.signals || []

  return (
    <div className="card rounded-none p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-(--brand-primary)" />
          <h2 className="text-xl font-bold">Ownership &amp; Authenticity</h2>
        </div>
      </div>

      {/* Verdict tile */}
      <div className={`flex items-center gap-4 p-4 ${v.bgSoft} border border-gray-100 mb-5`}>
        <div className={`flex h-16 w-16 items-center justify-center text-xl font-black text-white ${v.bg} ring-4 ${v.ring}`}>
          <v.Icon className="h-8 w-8" />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${v.text}`}>{v.label}</p>
          <p className="text-xs text-(--color-text-muted) mt-1">
            Authenticity score: <strong>{ownership.authenticity_score}/100</strong>
          </p>
          <p className="text-[11px] text-(--color-text-muted) italic mt-1">
            {v.blurb}
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryTile
          icon={ScrollText}
          label="License"
          value={ownership.license_name || 'Not found'}
          tone={licenseTone(ownership.license_classification)}
        />
        <SummaryTile
          icon={GitCommit}
          label="Git history"
          value={ownership.git_present ? `${ownership.git_unique_authors} committer${ownership.git_unique_authors === 1 ? '' : 's'}` : 'Not included'}
          tone={ownership.git_matches_seller ? 'ok' : ownership.git_present ? 'warn' : 'info'}
        />
        <SummaryTile
          icon={FileSignature}
          label="Copyright holders"
          value={ownership.copyright_holders_count.toString()}
          tone={ownership.copyright_holders_count >= 4 ? 'warn' : 'info'}
        />
        <SummaryTile
          icon={Copy}
          label="Internal overlap"
          value={ownership.fingerprint_matches > 0 ? `${ownership.fingerprint_matches} match${ownership.fingerprint_matches === 1 ? '' : 'es'}` : 'None'}
          tone={ownership.fingerprint_matches > 0 ? 'critical' : 'ok'}
        />
        <SummaryTile
          icon={Globe}
          label="Public repo match"
          value={ownership.github_match_count > 0 ? `${ownership.github_match_count} repo${ownership.github_match_count === 1 ? '' : 's'}` : 'None'}
          tone={ownership.github_match_count > 0 ? 'warn' : 'ok'}
        />
        <SummaryTile
          icon={EyeOff}
          label="Obfuscated files"
          value={ownership.obfuscated_file_count.toString()}
          tone={ownership.obfuscated_file_count > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Signal list */}
      {signals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-2">
            Evidence ({signals.length})
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(expanded ? signals : signals.slice(0, 6)).map((s) => (
              <SignalRow key={s.kind} signal={s} />
            ))}
            {!expanded && signals.length > 6 && (
              <p className="text-xs text-(--color-text-muted) text-center pt-2">
                + {signals.length - 6} more signals in full report
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-(--color-text-muted) italic mt-4">
        Verified via local static analysis: git authorship, LICENSE classification, copyright headers,
        obfuscation heuristics, internal fingerprint DB, and public GitHub code search.
      </p>
    </div>
  )
}

function verdictStyles(verdict: OwnershipVerdict) {
  switch (verdict) {
    case 'verified':
      return {
        bg: 'bg-green-500', ring: 'ring-green-200', bgSoft: 'bg-green-50',
        text: 'text-green-700', label: 'Ownership verified',
        Icon: ShieldCheck,
        blurb: 'Strong evidence the seller legitimately owns or created this code.',
      }
    case 'ok':
      return {
        bg: 'bg-lime-500', ring: 'ring-lime-200', bgSoft: 'bg-lime-50',
        text: 'text-lime-700', label: 'No ownership concerns',
        Icon: ShieldCheck,
        blurb: 'No red flags, though some evidence is missing for a stronger verdict.',
      }
    case 'suspicious':
      return {
        bg: 'bg-amber-500', ring: 'ring-amber-200', bgSoft: 'bg-amber-50',
        text: 'text-amber-700', label: 'Ownership unclear',
        Icon: ShieldAlert,
        blurb: 'Multiple authors or mismatched signals — buyer discretion advised.',
      }
    case 'stolen':
      return {
        bg: 'bg-red-500', ring: 'ring-red-200', bgSoft: 'bg-red-50',
        text: 'text-red-700', label: 'Likely stolen or repackaged',
        Icon: ShieldX,
        blurb: 'Critical red flags present — overlap with other sellers, restrictive license, or obfuscated code.',
      }
    default:
      return {
        bg: 'bg-gray-400', ring: 'ring-gray-200', bgSoft: 'bg-gray-50',
        text: 'text-gray-700', label: 'Not yet verified',
        Icon: ShieldAlert,
        blurb: 'Ownership analysis has not completed yet.',
      }
  }
}

function licenseTone(cls: string | null): Tone {
  if (cls === 'commercial-safe') return 'ok'
  if (cls === 'copyleft' || cls === 'non-commercial') return 'critical'
  if (cls === 'proprietary') return 'info'
  return 'info'
}

type Tone = 'ok' | 'info' | 'warn' | 'critical'

function toneClasses(tone: Tone): { label: string; value: string } {
  switch (tone) {
    case 'ok': return { label: 'text-green-700', value: 'text-green-800' }
    case 'warn': return { label: 'text-amber-700', value: 'text-amber-800' }
    case 'critical': return { label: 'text-red-700', value: 'text-red-800' }
    default: return { label: 'text-(--color-text-muted)', value: 'text-gray-800' }
  }
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: Tone
}) {
  const cls = toneClasses(tone)
  return (
    <div className="border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] uppercase tracking-wider ${cls.label}`}>{label}</span>
        <Icon className="h-3.5 w-3.5 text-(--color-text-muted)" />
      </div>
      <span className={`text-sm font-semibold ${cls.value} truncate block`}>{value}</span>
    </div>
  )
}

function strengthClasses(s: OwnershipSignalStrength): string {
  if (s === 'ok') return 'bg-green-100 text-green-700 border-green-200'
  if (s === 'warn') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (s === 'critical') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function SignalRow({ signal }: { signal: OwnershipSignal }) {
  return (
    <div className="border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${strengthClasses(signal.strength)}`}>
            {signal.strength}
          </span>
          <span className="text-xs font-mono text-gray-700 truncate">{signal.kind}</span>
        </div>
      </div>
      <p className="text-sm text-gray-800">{signal.description}</p>
      {signal.evidence && signal.evidence.length > 0 && (
        <div className="mt-1.5 border-l-2 border-gray-200 pl-2 space-y-0.5">
          {signal.evidence.slice(0, 5).map((e, i) => (
            <p key={i} className="text-[11px] text-(--color-text-muted) font-mono truncate break-all">
              {e}
            </p>
          ))}
          {signal.evidence.length > 5 && (
            <p className="text-[11px] text-(--color-text-muted) italic">
              + {signal.evidence.length - 5} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
