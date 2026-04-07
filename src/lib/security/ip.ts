import { NextRequest } from 'next/server'

/**
 * Safely extract client IP from request headers.
 * Prefers x-real-ip (reliably set by Vercel/reverse proxies),
 * then falls back to first entry of x-forwarded-for with validation.
 */
export function getClientIP(request: NextRequest): string {
  // x-real-ip is set reliably by Vercel and most reverse proxies
  const realIp = request.headers.get('x-real-ip')
  if (realIp && isValidIP(realIp)) {
    return realIp
  }

  // Fallback: first entry of x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim()
    if (isValidIP(firstIp)) {
      return firstIp
    }
  }

  return '0.0.0.0'
}

/**
 * Basic IP format validation to reject obviously spoofed values
 */
function isValidIP(ip: string): boolean {
  if (!ip || ip.length > 45) return false
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true
  // IPv6 (simplified check)
  if (ip.includes(':') && /^[0-9a-fA-F:]+$/.test(ip)) return true
  return false
}
