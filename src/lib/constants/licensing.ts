// 3-tier licensing model. Not CodeCanyon's regular/extended split —
// instead scales by scope of use so the tier a buyer picks maps
// cleanly to what they're actually allowed to do.

export type LicenseTier = 'personal' | 'commercial' | 'extended'

export interface LicenseTierDef {
  id: LicenseTier
  name: string
  tagline: string
  /** Multiplier applied to the product's base price_cents. */
  priceMultiplier: number
  /** Positive allowances shown to the buyer. */
  allows: string[]
  /** Hard limits shown to the buyer. */
  restrictions: string[]
}

export const LICENSE_TIERS: LicenseTierDef[] = [
  {
    id: 'personal',
    name: 'Personal',
    tagline: 'For hobby projects & learning',
    priceMultiplier: 1,
    allows: [
      'Use in 1 personal, non-commercial project',
      'Free lifetime updates',
      'Access to author support',
    ],
    restrictions: [
      'No commercial use',
      'Cannot be sold or transferred',
    ],
  },
  {
    id: 'commercial',
    name: 'Commercial',
    tagline: 'For client work & internal business apps',
    priceMultiplier: 3,
    allows: [
      'Use in 1 commercial project (yours or a client\u2019s)',
      'Charge end users for access to the final product',
      'Free lifetime updates',
      'Priority author support',
    ],
    restrictions: [
      'Cannot resell the source code itself',
      'Cannot bundle into a template or kit for resale',
    ],
  },
  {
    id: 'extended',
    name: 'Extended',
    tagline: 'For SaaS, white-label & resale',
    priceMultiplier: 10,
    allows: [
      'Unlimited commercial projects',
      'Resell as part of a larger SaaS or app',
      'White-label & rebrand',
      'Distribute as part of paid templates/kits',
      'Free lifetime updates',
      'Direct-to-author priority support',
    ],
    restrictions: [
      'Cannot resell the unmodified source code as-is',
    ],
  },
]

export const DEFAULT_LICENSE_TIER: LicenseTier = 'personal'

/**
 * Compute the effective price in cents for a given tier, honoring per-product
 * overrides if the seller has set them, otherwise applying the default multiplier.
 *
 *   overrides shape: { personal: 4900, commercial: 14900, extended: 49900 }
 */
export function resolveLicensePrice(
  basePriceCents: number,
  tier: LicenseTier,
  overrides?: Partial<Record<LicenseTier, number>> | null
): number {
  const override = overrides?.[tier]
  if (typeof override === 'number' && override > 0) return override

  const def = LICENSE_TIERS.find((t) => t.id === tier)
  if (!def) return basePriceCents
  return Math.round(basePriceCents * def.priceMultiplier)
}

/** Compute prices for all tiers at once — handy for product listing pages. */
export function resolveAllLicensePrices(
  basePriceCents: number,
  overrides?: Partial<Record<LicenseTier, number>> | null
): Record<LicenseTier, number> {
  return {
    personal: resolveLicensePrice(basePriceCents, 'personal', overrides),
    commercial: resolveLicensePrice(basePriceCents, 'commercial', overrides),
    extended: resolveLicensePrice(basePriceCents, 'extended', overrides),
  }
}

export function getLicenseTierDef(tier: LicenseTier): LicenseTierDef {
  return LICENSE_TIERS.find((t) => t.id === tier) || LICENSE_TIERS[0]
}
