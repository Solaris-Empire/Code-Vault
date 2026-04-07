import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIP as getClientIPFromModule } from './ip'

// Session configuration
const SESSION_TIMEOUT_MINUTES = 30
const SESSION_MAX_AGE_HOURS = 24
const ACTIVITY_HEADER = 'x-last-activity'

/**
 * Get the session timeout in milliseconds
 */
export function getSessionTimeout(): number {
  return SESSION_TIMEOUT_MINUTES * 60 * 1000
}

/**
 * Get the max session age in milliseconds
 */
export function getMaxSessionAge(): number {
  return SESSION_MAX_AGE_HOURS * 60 * 60 * 1000
}

/**
 * Check if a session has timed out due to inactivity
 */
export function isSessionTimedOut(lastActivity: Date | string | null): boolean {
  if (!lastActivity) return true

  const lastActivityTime = typeof lastActivity === 'string'
    ? new Date(lastActivity).getTime()
    : lastActivity.getTime()

  const now = Date.now()
  const timeout = getSessionTimeout()

  return (now - lastActivityTime) > timeout
}

/**
 * Check if a session has exceeded maximum age
 */
export function isSessionExpired(createdAt: Date | string | null): boolean {
  if (!createdAt) return true

  const createdTime = typeof createdAt === 'string'
    ? new Date(createdAt).getTime()
    : createdAt.getTime()

  const now = Date.now()
  const maxAge = getMaxSessionAge()

  return (now - createdTime) > maxAge
}

/**
 * Update user's last activity timestamp
 */
export async function updateLastActivity(userId: string): Promise<void> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabaseAdmin
      .from('profiles')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', userId)
  } catch (error) {
    // Don't fail the request if activity update fails
    console.error('Failed to update last activity:', error)
  }
}

/**
 * Secure cookie options for session management
 */
export const secureCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_HOURS * 60 * 60 // in seconds
}

/**
 * Set secure session cookie
 */
export function setSecureSessionCookie(
  response: NextResponse,
  name: string,
  value: string
): NextResponse {
  response.cookies.set(name, value, secureCookieOptions)
  return response
}

/**
 * Clear a session cookie
 */
export function clearSessionCookie(response: NextResponse, name: string): NextResponse {
  response.cookies.set(name, '', {
    ...secureCookieOptions,
    maxAge: 0
  })
  return response
}

/**
 * Force logout a user (invalidate all sessions)
 */
export async function forceLogout(userId: string): Promise<boolean> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update user metadata to invalidate sessions
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        sessions_invalidated_at: new Date().toISOString()
      }
    })

    if (error) {
      console.error('Force logout error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Force logout error:', error)
    return false
  }
}

/**
 * Check if user's sessions have been invalidated
 */
export function isSessionInvalidated(
  sessionCreatedAt: Date | string,
  invalidatedAt: Date | string | null
): boolean {
  if (!invalidatedAt) return false

  const sessionTime = typeof sessionCreatedAt === 'string'
    ? new Date(sessionCreatedAt).getTime()
    : sessionCreatedAt.getTime()

  const invalidatedTime = typeof invalidatedAt === 'string'
    ? new Date(invalidatedAt).getTime()
    : invalidatedAt.getTime()

  return sessionTime < invalidatedTime
}

/**
 * Middleware helper to check session validity
 */
export async function validateSession(
  request: NextRequest,
  userId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user profile with activity info
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('last_activity_at, created_at')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      return { valid: false, reason: 'User profile not found' }
    }

    // Check for inactivity timeout
    if (profile.last_activity_at && isSessionTimedOut(profile.last_activity_at)) {
      return { valid: false, reason: 'Session timed out due to inactivity' }
    }

    // Update activity timestamp for valid sessions
    await updateLastActivity(userId)

    return { valid: true }
  } catch (error) {
    console.error('Session validation error:', error)
    return { valid: false, reason: 'Session validation failed due to internal error' }
  }
}

/**
 * Get client IP address from request (delegates to centralized IP module)
 */
export function getClientIp(request: NextRequest): string {
  return getClientIPFromModule(request)
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'Unknown'
}
