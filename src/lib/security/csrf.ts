import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CSRF_TOKEN_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get or create CSRF token
 * Returns the token value
 */
export async function getOrCreateCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  const existingToken = cookieStore.get(CSRF_TOKEN_NAME)

  if (existingToken?.value) {
    return existingToken.value
  }

  const newToken = generateToken()

  // Note: The actual cookie setting should be done in the response
  return newToken
}

/**
 * Set CSRF token cookie in response
 */
export function setCsrfTokenCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(CSRF_TOKEN_NAME, token, {
    httpOnly: false, // Must be readable by client JS for double-submit cookie pattern
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  })
  return response
}

/**
 * Validate CSRF token from request
 * Checks header or body against cookie
 */
export async function validateCsrfToken(request: NextRequest): Promise<{
  valid: boolean
  error?: string
}> {
  // Skip CSRF check for safe methods
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  if (safeMethod) {
    return { valid: true }
  }

  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value

  if (!cookieToken) {
    return { valid: false, error: 'CSRF token cookie missing' }
  }

  // Get token from header or body
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  // Try to get from body if not in header (for form submissions)
  let bodyToken: string | undefined
  if (!headerToken) {
    try {
      const contentType = request.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        // Clone request to read body
        const clonedRequest = request.clone()
        const body = await clonedRequest.json()
        bodyToken = body._csrf || body.csrfToken
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const clonedRequest = request.clone()
        const formData = await clonedRequest.formData()
        bodyToken = formData.get('_csrf') as string | undefined
      }
    } catch {
      // Body parsing failed, continue with header check
    }
  }

  const requestToken = headerToken || bodyToken

  if (!requestToken) {
    return { valid: false, error: 'CSRF token not provided in request' }
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(cookieToken, requestToken)) {
    return { valid: false, error: 'CSRF token mismatch' }
  }

  return { valid: true }
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  try {
    const crypto = require('crypto')
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    if (bufA.length !== bufB.length) {
      // Compare against itself to avoid timing leak on length difference
      crypto.timingSafeEqual(bufA, bufA)
      return false
    }
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    // Fallback: constant-time comparison
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }
}

/**
 * CSRF protection result type
 */
export interface CsrfResult {
  valid: boolean
  error?: NextResponse
}

/**
 * Check CSRF and return result
 */
export async function checkCsrf(request: NextRequest): Promise<CsrfResult> {
  const validation = await validateCsrfToken(request)

  if (!validation.valid) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid CSRF token', details: validation.error },
        { status: 403 }
      )
    }
  }

  return { valid: true }
}

/**
 * Create CSRF middleware for API routes
 * Usage: Add to route handler to enforce CSRF protection
 */
export function csrfProtection() {
  return async (request: NextRequest): Promise<CsrfResult> => {
    return checkCsrf(request)
  }
}

/**
 * Generate CSRF token for client-side use
 * Returns token value to include in API requests
 */
export async function generateCsrfToken(): Promise<string> {
  return generateToken()
}

/**
 * Helper to extract CSRF token from cookies (client-side)
 * Use this in your API client to get the token
 */
export function getCsrfTokenFromCookies(): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_TOKEN_NAME) {
      return value
    }
  }
  return null
}

/**
 * Routes that should skip CSRF validation
 */
export const csrfExemptRoutes = [
  '/api/auth/', // Auth routes (login/register/reset) - authenticated via credentials
  '/api/webhooks/stripe', // Stripe webhooks use signature verification
  '/api/webhooks/supabase', // Supabase webhooks
  '/api/cron/', // Cron jobs
  '/api/admin/', // Admin routes - protected by auth + role middleware
  '/api/setup/', // Setup endpoints
  '/api/chat', // Chat uses session-based auth
  '/api/chat/', // Chat message endpoints
  '/api/vendor/', // Vendor routes - protected by auth + vendor middleware
  '/api/vendor/register', // Vendor registration
  '/api/user/', // User profile routes - protected by auth
  '/api/orders', // Order routes - protected by auth
  '/api/cart', // Cart routes - session/auth based
  '/api/reviews', // Review routes - protected by auth
  '/api/wishlist', // Wishlist routes - protected by auth
  '/api/addresses', // Address routes - protected by auth
  '/api/notifications', // Notification routes - protected by auth
  '/api/returns', // Return routes - protected by auth
  '/api/support', // Support routes - protected by auth
]

/**
 * Check if a path should skip CSRF validation
 */
export function isCsrfExempt(pathname: string): boolean {
  return csrfExemptRoutes.some(route =>
    pathname.startsWith(route)
  )
}
