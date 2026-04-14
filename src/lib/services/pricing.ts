// Service-order pricing — mirrors src/lib/currency.ts logic for products.
// Same 15% platform fee, same rounding semantics, so a $100 gig and a $100
// product both yield the same $15 platform cut + $85 seller payout.

export const PLATFORM_FEE_PERCENT = 15

export interface ServicePriceBreakdown {
  amountCents: number
  platformFeeCents: number
  sellerPayoutCents: number
}

/** Computes the split for a fixed-price order given the gig's price. */
export function computeFixedSplit(priceCents: number): ServicePriceBreakdown {
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_PERCENT / 100)
  return {
    amountCents: priceCents,
    platformFeeCents,
    sellerPayoutCents: priceCents - platformFeeCents,
  }
}

/** Computes the split for an hourly order. Hours must be > 0. */
export function computeHourlySplit(hourlyRateCents: number, hours: number): ServicePriceBreakdown {
  const amountCents = Math.round(hourlyRateCents * hours)
  return computeFixedSplit(amountCents)
}
