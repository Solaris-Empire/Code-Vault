/**
 * CodeVault Currency Utilities
 * Price formatting for digital code marketplace (USD)
 */

const PLATFORM_FEE_PERCENT = 15

/**
 * Format cents to USD string
 * @example formatPrice(1999) // "$19.99"
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Calculate commission split
 * @example calculateCommission(1000) // { platformFee: 150, sellerPayout: 850 }
 */
export function calculateCommission(priceCents: number): {
  platformFee: number
  sellerPayout: number
} {
  const platformFee = Math.round(priceCents * PLATFORM_FEE_PERCENT / 100)
  const sellerPayout = priceCents - platformFee
  return { platformFee, sellerPayout }
}

/**
 * Parse a dollar string to cents
 * @example parsePriceToCents("$19.99") // 1999
 */
export function parsePriceToCents(priceString: string): number {
  const cleaned = priceString.replace(/[^0-9.-]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars)) return 0
  return Math.round(dollars * 100)
}
