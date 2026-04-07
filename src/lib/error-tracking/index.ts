/**
 * Error tracking integration - Sentry-ready
 *
 * Provides centralized error capture and reporting.
 * Currently logs to console + stores recent errors in memory.
 * Drop in Sentry by installing @sentry/nextjs and setting SENTRY_DSN.
 *
 * Usage:
 *   import { captureError, captureMessage } from '@/lib/error-tracking'
 *   captureError(error, { context: 'checkout', userId: '...' })
 */

interface ErrorContext {
  /** Where the error occurred (e.g., 'checkout', 'api:products', 'webhook') */
  context?: string
  /** User ID if available */
  userId?: string
  /** Additional structured data */
  extra?: Record<string, unknown>
  /** Error severity */
  level?: 'fatal' | 'error' | 'warning' | 'info'
}

interface TrackedError {
  id: string
  message: string
  stack?: string
  context: ErrorContext
  timestamp: string
  count: number
}

// Recent errors buffer (ring buffer, max 500)
const recentErrors: TrackedError[] = []
const MAX_ERRORS = 500
const errorCounts = new Map<string, number>()

function generateErrorId(message: string, context?: string): string {
  return `${context || 'unknown'}:${message.slice(0, 100)}`
}

/**
 * Capture and track an error.
 */
export function captureError(error: Error | string, ctx: ErrorContext = {}) {
  const message = typeof error === 'string' ? error : error.message
  const stack = typeof error === 'string' ? undefined : error.stack
  const level = ctx.level || 'error'

  // Deduplicate: increment count for repeated errors
  const errorId = generateErrorId(message, ctx.context)
  const existingCount = errorCounts.get(errorId) || 0
  errorCounts.set(errorId, existingCount + 1)

  // Only store unique errors (by id)
  const existing = recentErrors.find((e) => e.id === errorId)
  if (existing) {
    existing.count = existingCount + 1
    existing.timestamp = new Date().toISOString()
    return
  }

  const tracked: TrackedError = {
    id: errorId,
    message,
    stack,
    context: ctx,
    timestamp: new Date().toISOString(),
    count: 1,
  }

  recentErrors.push(tracked)
  if (recentErrors.length > MAX_ERRORS) {
    recentErrors.shift()
  }

  // Console output for dev/logging
  if (level === 'fatal' || level === 'error') {
    console.error(`[${level}] [${ctx.context || 'app'}]`, message, ctx.extra || '')
  } else {
    console.warn(`[${level}] [${ctx.context || 'app'}]`, message)
  }

  // Future: Sentry integration
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(error, { tags: { context: ctx.context }, extra: ctx.extra })
  // }
}

/**
 * Capture a message (non-error event).
 */
export function captureMessage(message: string, ctx: ErrorContext = {}) {
  captureError(message, { ...ctx, level: ctx.level || 'info' })
}

/**
 * Get recent tracked errors (for monitoring dashboard).
 */
export function getRecentErrors(limit: number = 50): TrackedError[] {
  return recentErrors.slice(-limit).reverse()
}

/**
 * Get error summary stats.
 */
export function getErrorStats() {
  const now = Date.now()
  const oneHourAgo = now - 60 * 60_000
  const oneDayAgo = now - 24 * 60 * 60_000

  const recent = recentErrors.filter(
    (e) => new Date(e.timestamp).getTime() > oneHourAgo
  )
  const daily = recentErrors.filter(
    (e) => new Date(e.timestamp).getTime() > oneDayAgo
  )

  return {
    total: recentErrors.length,
    lastHour: recent.length,
    last24h: daily.length,
    topErrors: recentErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((e) => ({ id: e.id, message: e.message, count: e.count, context: e.context.context })),
  }
}

/**
 * Wrap an async function with automatic error capture.
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      captureError(error instanceof Error ? error : new Error(String(error)), { context })
      throw error
    }
  }) as T
}
