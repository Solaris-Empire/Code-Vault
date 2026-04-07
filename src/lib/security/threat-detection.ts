import { NextRequest, NextResponse } from 'next/server'
import { logSuspiciousActivity } from './audit'

// Threat detection configuration
const THREAT_CONFIG = {
  // Max failed login attempts before lockout
  maxFailedLogins: 5,
  // Lockout duration in milliseconds (15 minutes)
  lockoutDuration: 15 * 60 * 1000,
  // Max requests from single IP in short window (potential DDoS)
  maxRequestsPerSecond: 50,
  // Suspicious patterns in input
  sqlInjectionPatterns: [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|into|table|database)\b)/i,
    /(\b(or|and)\b\s+[\d\w]+\s*=\s*[\d\w]+)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\bwaitfor\b\s+\bdelay\b)/i,
    /(\bsleep\s*\(\s*\d+\s*\))/i
  ],
  xssPatterns: [
    /<script[^>]*>/i,
    /javascript:/i,
    /(<[^>]+|\s)on\w+\s*=/i,
    /\beval\s*\(/i,
    /\bdocument\s*\.\s*(cookie|write|location)/i,
    /\bwindow\s*\.\s*(location|open)/i
  ],
  pathTraversalPatterns: [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e/i,
    /%252e/i
  ]
}

// In-memory stores for threat tracking
const failedLoginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const lockedAccounts = new Map<string, number>() // email -> lockout expiry
const blockedIPs = new Map<string, number>() // IP -> block expiry
const requestCounts = new Map<string, { count: number; windowStart: number }>()

// Maximum entries per map to prevent OOM under sustained attack
const MAX_MAP_SIZE = 10000

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()

  for (const [key, expiry] of lockedAccounts.entries()) {
    if (expiry < now) lockedAccounts.delete(key)
  }

  for (const [key, expiry] of blockedIPs.entries()) {
    if (expiry < now) blockedIPs.delete(key)
  }

  for (const [key, data] of failedLoginAttempts.entries()) {
    if (data.firstAttempt + THREAT_CONFIG.lockoutDuration < now) {
      failedLoginAttempts.delete(key)
    }
  }
}, 60000)

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0].trim() || realIp || 'unknown'
}

/**
 * Check if an IP is currently blocked
 */
export function isIPBlocked(ip: string): boolean {
  const expiry = blockedIPs.get(ip)
  if (!expiry) return false
  if (expiry < Date.now()) {
    blockedIPs.delete(ip)
    return false
  }
  return true
}

/**
 * Block an IP address
 */
export function blockIP(ip: string, durationMs: number = 3600000): void {
  if (blockedIPs.size > MAX_MAP_SIZE) blockedIPs.clear()
  blockedIPs.set(ip, Date.now() + durationMs)
}

/**
 * Check if account is locked out
 */
export function isAccountLocked(email: string): boolean {
  const expiry = lockedAccounts.get(email.toLowerCase())
  if (!expiry) return false
  if (expiry < Date.now()) {
    lockedAccounts.delete(email.toLowerCase())
    return false
  }
  return true
}

/**
 * Get remaining lockout time in seconds
 */
export function getLockoutRemaining(email: string): number {
  const expiry = lockedAccounts.get(email.toLowerCase())
  if (!expiry) return 0
  const remaining = Math.ceil((expiry - Date.now()) / 1000)
  return remaining > 0 ? remaining : 0
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(email: string, ip: string): { locked: boolean; attemptsRemaining: number } {
  const key = email.toLowerCase()
  const now = Date.now()

  let attempts = failedLoginAttempts.get(key)

  if (!attempts || attempts.firstAttempt + THREAT_CONFIG.lockoutDuration < now) {
    attempts = { count: 1, firstAttempt: now }
  } else {
    attempts.count++
  }

  if (failedLoginAttempts.size > MAX_MAP_SIZE) failedLoginAttempts.clear()
  failedLoginAttempts.set(key, attempts)

  if (attempts.count >= THREAT_CONFIG.maxFailedLogins) {
    // Lock the account
    if (lockedAccounts.size > MAX_MAP_SIZE) lockedAccounts.clear()
    lockedAccounts.set(key, now + THREAT_CONFIG.lockoutDuration)
    failedLoginAttempts.delete(key)

    // Also consider blocking the IP if same IP has multiple lockouts
    return { locked: true, attemptsRemaining: 0 }
  }

  return {
    locked: false,
    attemptsRemaining: THREAT_CONFIG.maxFailedLogins - attempts.count
  }
}

/**
 * Clear failed login attempts on successful login
 */
export function clearFailedLogins(email: string): void {
  failedLoginAttempts.delete(email.toLowerCase())
}

/**
 * Detect SQL injection patterns in input
 */
export function detectSQLInjection(input: string): boolean {
  return THREAT_CONFIG.sqlInjectionPatterns.some(pattern => pattern.test(input))
}

/**
 * Detect XSS patterns in input
 */
export function detectXSS(input: string): boolean {
  return THREAT_CONFIG.xssPatterns.some(pattern => pattern.test(input))
}

/**
 * Detect path traversal attempts
 */
export function detectPathTraversal(input: string): boolean {
  return THREAT_CONFIG.pathTraversalPatterns.some(pattern => pattern.test(input))
}

/**
 * Scan input for all threat patterns
 */
export function scanForThreats(input: string): {
  isThreat: boolean
  threatTypes: string[]
} {
  const threatTypes: string[] = []

  if (detectSQLInjection(input)) threatTypes.push('sql_injection')
  if (detectXSS(input)) threatTypes.push('xss')
  if (detectPathTraversal(input)) threatTypes.push('path_traversal')

  return {
    isThreat: threatTypes.length > 0,
    threatTypes
  }
}

/**
 * Deep scan an object for threats
 */
export function scanObjectForThreats(obj: unknown, path: string = ''): {
  isThreat: boolean
  threats: Array<{ path: string; types: string[] }>
} {
  const threats: Array<{ path: string; types: string[] }> = []

  function scan(value: unknown, currentPath: string) {
    if (typeof value === 'string') {
      const result = scanForThreats(value)
      if (result.isThreat) {
        threats.push({ path: currentPath, types: result.threatTypes })
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${currentPath}[${index}]`))
    } else if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
        scan(val, currentPath ? `${currentPath}.${key}` : key)
      })
    }
  }

  scan(obj, path)

  return {
    isThreat: threats.length > 0,
    threats
  }
}

/**
 * Check for DDoS-like behavior (too many requests)
 */
export function checkRequestRate(ip: string): { allowed: boolean; requestsInWindow: number } {
  const now = Date.now()
  const windowMs = 1000 // 1 second window

  let data = requestCounts.get(ip)

  if (!data || data.windowStart + windowMs < now) {
    data = { count: 1, windowStart: now }
    if (requestCounts.size > MAX_MAP_SIZE) requestCounts.clear()
    requestCounts.set(ip, data)
    return { allowed: true, requestsInWindow: 1 }
  }

  data.count++

  if (data.count > THREAT_CONFIG.maxRequestsPerSecond) {
    return { allowed: false, requestsInWindow: data.count }
  }

  return { allowed: true, requestsInWindow: data.count }
}

/**
 * Honeypot field names - if these are filled, it's a bot
 */
// Private - not exported directly to prevent attackers from reading field names in client bundle
const HONEYPOT_FIELDS = ['website_url', 'fax_number', 'company_website', 'secondary_email']

/**
 * Get honeypot field names for form rendering
 */
export function getHoneypotFields(): string[] {
  return [...HONEYPOT_FIELDS]
}

/**
 * Check if honeypot fields are filled (indicates bot)
 */
export function checkHoneypot(data: Record<string, unknown>): boolean {
  return HONEYPOT_FIELDS.some(field => {
    const value = data[field]
    return value !== undefined && value !== null && value !== ''
  })
}

/**
 * Comprehensive threat check middleware
 */
export async function threatCheck(request: NextRequest): Promise<{
  safe: boolean
  error?: NextResponse
  threats?: string[]
}> {
  const ip = getClientIP(request)

  // Check if IP is blocked
  if (isIPBlocked(ip)) {
    return {
      safe: false,
      error: NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      ),
      threats: ['blocked_ip']
    }
  }

  // Check request rate
  const rateCheck = checkRequestRate(ip)
  if (!rateCheck.allowed) {
    await logSuspiciousActivity(
      request,
      `Potential DDoS: ${rateCheck.requestsInWindow} requests/second from ${ip}`,
      { requestCount: rateCheck.requestsInWindow }
    )

    // Block IP for 1 hour
    blockIP(ip, 3600000)

    return {
      safe: false,
      error: NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      ),
      threats: ['ddos_attempt']
    }
  }

  // For POST/PUT/PATCH, check request body
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const clonedRequest = request.clone()
      const contentType = request.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        const body = await clonedRequest.json()

        // Check honeypot
        if (checkHoneypot(body)) {
          await logSuspiciousActivity(
            request,
            'Bot detected via honeypot',
            { ip }
          )

          return {
            safe: false,
            error: NextResponse.json(
              { error: 'Invalid request' },
              { status: 400 }
            ),
            threats: ['bot_detected']
          }
        }

        // Scan for injection attacks
        const scanResult = scanObjectForThreats(body)
        if (scanResult.isThreat) {
          await logSuspiciousActivity(
            request,
            `Injection attack detected: ${scanResult.threats.map(t => t.types.join(',')).join('; ')}`,
            { threats: scanResult.threats, ip }
          )

          return {
            safe: false,
            error: NextResponse.json(
              { error: 'Invalid input detected' },
              { status: 400 }
            ),
            threats: scanResult.threats.flatMap(t => t.types)
          }
        }
      }
    } catch {
      // Body parsing failed, continue
    }
  }

  // Check URL path for traversal
  const pathCheck = scanForThreats(request.nextUrl.pathname)
  if (pathCheck.isThreat) {
    await logSuspiciousActivity(
      request,
      `Path traversal attempt: ${request.nextUrl.pathname}`,
      { ip }
    )

    return {
      safe: false,
      error: NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      ),
      threats: pathCheck.threatTypes
    }
  }

  // Check query params
  const queryString = request.nextUrl.search
  if (queryString) {
    const queryCheck = scanForThreats(queryString)
    if (queryCheck.isThreat) {
      await logSuspiciousActivity(
        request,
        `Injection in query params: ${queryString}`,
        { ip }
      )

      return {
        safe: false,
        error: NextResponse.json(
          { error: 'Invalid query parameters' },
          { status: 400 }
        ),
        threats: queryCheck.threatTypes
      }
    }
  }

  return { safe: true }
}

/**
 * User agent analysis for bot detection
 */
export function analyzeUserAgent(userAgent: string): {
  isBot: boolean
  isSuspicious: boolean
  reason?: string
} {
  const ua = userAgent.toLowerCase()

  // Known bot patterns
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python-requests/i, /axios/i,
    /postman/i, /insomnia/i
  ]

  // Suspicious patterns
  const suspiciousPatterns = [
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
    /playwright/i, /webdriver/i
  ]

  // Empty or very short user agent is suspicious
  if (!userAgent || userAgent.length < 10) {
    return { isBot: false, isSuspicious: true, reason: 'Empty or short user agent' }
  }

  for (const pattern of botPatterns) {
    if (pattern.test(ua)) {
      return { isBot: true, isSuspicious: false, reason: 'Known bot pattern' }
    }
  }

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(ua)) {
      return { isBot: false, isSuspicious: true, reason: 'Automation tool detected' }
    }
  }

  return { isBot: false, isSuspicious: false }
}
