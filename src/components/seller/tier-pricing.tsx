'use client'

import { Layers, Sparkles } from 'lucide-react'
import { LICENSE_TIERS, type LicenseTier } from '@/lib/constants/licensing'

export type TierPriceInput = Partial<Record<LicenseTier, string>>

interface Props {
  basePriceDollars: string
  useCustom: boolean
  setUseCustom: (v: boolean) => void
  customPrices: TierPriceInput
  setCustomPrices: (prices: TierPriceInput) => void
}

export function TierPricingSection({
  basePriceDollars,
  useCustom,
  setUseCustom,
  customPrices,
  setCustomPrices,
}: Props) {
  const base = parseFloat(basePriceDollars) || 0

  const autoPrice = (tier: LicenseTier) => {
    const def = LICENSE_TIERS.find((t) => t.id === tier)!
    return (base * def.priceMultiplier).toFixed(2)
  }

  const updateTier = (tier: LicenseTier, val: string) => {
    setCustomPrices({ ...customPrices, [tier]: val })
  }

  return (
    <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5 text-(--brand-primary)" />
          License Tier Pricing
        </h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
            className="h-4 w-4 accent-(--brand-primary)"
          />
          <span className="text-(--color-text-secondary)">Set custom prices</span>
        </label>
      </div>

      <p className="text-xs text-(--color-text-muted) -mt-2">
        Buyers pick a tier at checkout. By default we auto-scale from your base price
        (1× Personal, 3× Commercial, 10× Extended). Check the box above to override any tier.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {LICENSE_TIERS.map((tier) => {
          const auto = autoPrice(tier.id)
          const isPopular = tier.id === 'commercial'
          return (
            <div
              key={tier.id}
              className={`border p-4 ${isPopular ? 'border-(--brand-primary)' : 'border-(--color-border)'} bg-(--color-elevated)`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-(--color-text-primary)">{tier.name}</span>
                {isPopular && (
                  <span className="text-[10px] font-semibold tracking-wider uppercase bg-(--brand-amber) text-white px-1.5 py-0.5">
                    Popular
                  </span>
                )}
              </div>
              <p className="text-xs text-(--color-text-muted) mb-3 min-h-8">{tier.tagline}</p>

              {useCustom ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) text-sm">$</span>
                  <input
                    type="number"
                    value={customPrices[tier.id] ?? ''}
                    onChange={(e) => updateTier(tier.id, e.target.value)}
                    placeholder={auto}
                    min="0"
                    step="0.01"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-none pl-7 pr-3 py-2 text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) focus:ring-1 focus:ring-(--brand-primary) outline-none text-sm"
                  />
                  <p className="text-[10px] text-(--color-text-muted) mt-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Auto would be ${auto}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-xl font-bold text-(--color-text-primary)">
                    ${auto}
                  </div>
                  <p className="text-[10px] text-(--color-text-muted) mt-1 uppercase tracking-wider">
                    {tier.priceMultiplier}× base price
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Convert dollar-string inputs to a cents object suitable for the API.
 * Returns null when `useCustom` is false or no valid overrides were entered.
 */
export function buildLicensePricesCents(
  useCustom: boolean,
  customPrices: TierPriceInput
): { personal?: number; commercial?: number; extended?: number } | null {
  if (!useCustom) return null
  const out: { personal?: number; commercial?: number; extended?: number } = {}
  for (const tier of ['personal', 'commercial', 'extended'] as const) {
    const raw = customPrices[tier]
    if (raw && raw.trim() !== '') {
      const dollars = parseFloat(raw)
      if (!isNaN(dollars) && dollars > 0) {
        out[tier] = Math.round(dollars * 100)
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
