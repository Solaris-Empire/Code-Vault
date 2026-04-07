import { NextRequest, NextResponse } from 'next/server'

// Request size limits by content type (in bytes)
const SIZE_LIMITS = {
  'application/json': 1024 * 1024, // 1MB for JSON
  'multipart/form-data': 10 * 1024 * 1024, // 10MB for file uploads
  'application/x-www-form-urlencoded': 256 * 1024, // 256KB for forms
  default: 512 * 1024 // 512KB default
}

// Endpoints with custom size limits
const ENDPOINT_LIMITS: Record<string, number> = {
  '/api/upload': 10 * 1024 * 1024, // 10MB for uploads
  '/api/admin/import': 50 * 1024 * 1024, // 50MB for imports
  '/api/chat': 64 * 1024 // 64KB for chat messages
}

/**
 * Validate request content length
 */
export function validateContentLength(request: NextRequest): {
  valid: boolean
  error?: NextResponse
  limit?: number
  actual?: number
} {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) {
    // No content length header - allow but be cautious
    return { valid: true }
  }

  const size = parseInt(contentLength, 10)
  if (isNaN(size)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid content-length header' },
        { status: 400 }
      )
    }
  }

  // Check endpoint-specific limit
  const pathname = request.nextUrl.pathname
  for (const [endpoint, limit] of Object.entries(ENDPOINT_LIMITS)) {
    if (pathname.startsWith(endpoint)) {
      if (size > limit) {
        return {
          valid: false,
          error: NextResponse.json(
            { error: 'Request too large', maxSize: limit },
            { status: 413 }
          ),
          limit,
          actual: size
        }
      }
      return { valid: true, limit, actual: size }
    }
  }

  // Check content-type specific limit
  const contentType = request.headers.get('content-type')?.split(';')[0].trim()
  const limit = contentType && SIZE_LIMITS[contentType as keyof typeof SIZE_LIMITS]
    ? SIZE_LIMITS[contentType as keyof typeof SIZE_LIMITS]
    : SIZE_LIMITS.default

  if (size > limit) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Request too large', maxSize: limit },
        { status: 413 }
      ),
      limit,
      actual: size
    }
  }

  return { valid: true, limit, actual: size }
}

/**
 * Validate required headers
 */
export function validateRequiredHeaders(request: NextRequest, headers: string[]): {
  valid: boolean
  missing?: string[]
  error?: NextResponse
} {
  const missing = headers.filter(h => !request.headers.get(h))

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      error: NextResponse.json(
        { error: 'Missing required headers', headers: missing },
        { status: 400 }
      )
    }
  }

  return { valid: true }
}

/**
 * Validate content type for specific methods
 */
export function validateContentType(request: NextRequest, allowedTypes: string[]): {
  valid: boolean
  error?: NextResponse
} {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
    return { valid: true }
  }

  const contentType = request.headers.get('content-type')?.split(';')[0].trim()

  if (!contentType) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Content-Type header required' },
        { status: 400 }
      )
    }
  }

  if (!allowedTypes.includes(contentType)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Unsupported content type', allowed: allowedTypes },
        { status: 415 }
      )
    }
  }

  return { valid: true }
}

/**
 * Validate origin for CORS
 */
export function validateOrigin(request: NextRequest, allowedOrigins: string[]): {
  valid: boolean
  error?: NextResponse
} {
  const origin = request.headers.get('origin')

  // No origin header (same-origin request)
  if (!origin) {
    return { valid: true }
  }

  // Check against allowed origins
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    )
  }
}

/**
 * Validate referer header (for additional CSRF protection)
 */
export function validateReferer(request: NextRequest, allowedHosts: string[]): {
  valid: boolean
  error?: NextResponse
} {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return { valid: true }
  }

  const referer = request.headers.get('referer')

  // No referer is suspicious but we have other protections
  if (!referer) {
    return { valid: true }
  }

  try {
    const refererUrl = new URL(referer)
    if (allowedHosts.includes(refererUrl.host)) {
      return { valid: true }
    }
  } catch {
    // Invalid referer URL
  }

  return {
    valid: false,
    error: NextResponse.json(
      { error: 'Invalid referer' },
      { status: 403 }
    )
  }
}

/**
 * Request timing validation (detect slow attacks)
 */
const requestTimings = new Map<string, number[]>()

export function trackRequestTiming(ip: string, responseTimeMs: number): {
  averageTime: number
  isAnomaly: boolean
} {
  let timings = requestTimings.get(ip) || []
  timings.push(responseTimeMs)

  // Keep last 100 timings
  if (timings.length > 100) {
    timings = timings.slice(-100)
  }

  requestTimings.set(ip, timings)

  const average = timings.reduce((a, b) => a + b, 0) / timings.length

  // Anomaly if current timing is 10x slower than average
  const isAnomaly = responseTimeMs > average * 10 && timings.length > 10

  return { averageTime: average, isAnomaly }
}

/**
 * Validate API version header (if using versioned API)
 */
export function validateApiVersion(request: NextRequest, supportedVersions: string[]): {
  valid: boolean
  version?: string
  error?: NextResponse
} {
  const version = request.headers.get('x-api-version') || request.headers.get('api-version')

  if (!version) {
    // Default to latest
    return { valid: true, version: supportedVersions[0] }
  }

  if (!supportedVersions.includes(version)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Unsupported API version', supported: supportedVersions },
        { status: 400 }
      )
    }
  }

  return { valid: true, version }
}

/**
 * Generate request fingerprint for tracking
 */
export function generateRequestFingerprint(request: NextRequest): string {
  const parts = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    request.headers.get('x-forwarded-for')?.split(',')[0] || ''
  ]

  // Simple hash
  let hash = 0
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return Math.abs(hash).toString(36)
}

/**
 * Comprehensive request validation
 */
export async function validateRequest(request: NextRequest, options?: {
  requireAuth?: boolean
  allowedContentTypes?: string[]
  customSizeLimit?: number
}): Promise<{
  valid: boolean
  error?: NextResponse
  fingerprint: string
}> {
  const fingerprint = generateRequestFingerprint(request)

  // Validate content length
  const sizeCheck = validateContentLength(request)
  if (!sizeCheck.valid) {
    return { valid: false, error: sizeCheck.error, fingerprint }
  }

  // Validate content type if specified
  if (options?.allowedContentTypes) {
    const typeCheck = validateContentType(request, options.allowedContentTypes)
    if (!typeCheck.valid) {
      return { valid: false, error: typeCheck.error, fingerprint }
    }
  }

  return { valid: true, fingerprint }
}
