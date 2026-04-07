import { NextRequest } from 'next/server'
import { logSuspiciousActivity } from './audit'

// Security event types
export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'account_locked'
  | 'rate_limited'
  | 'csrf_violation'
  | 'injection_attempt'
  | 'bot_detected'
  | 'ip_blocked'
  | 'suspicious_activity'
  | 'password_reset'
  | 'permission_denied'
  | 'data_export'
  | 'bulk_operation'
  | 'admin_action'

export interface SecurityEvent {
  type: SecurityEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  ip: string
  userId?: string
  userEmail?: string
  description: string
  metadata?: Record<string, unknown>
  timestamp: Date
}

// In-memory event buffer for real-time monitoring
const eventBuffer: SecurityEvent[] = []
const MAX_BUFFER_SIZE = 1000

// Security metrics
const metrics = {
  loginAttempts: { success: 0, failure: 0 },
  blockedRequests: 0,
  rateLimitHits: 0,
  injectionAttempts: 0,
  csrfViolations: 0,
  suspiciousActivities: 0
}

/**
 * Record a security event
 */
export function recordSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date()
  }

  // Add to buffer
  eventBuffer.push(fullEvent)

  // Trim buffer if too large
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift()
  }

  // Update metrics
  updateMetrics(event.type)

  // Log critical events immediately
  if (event.severity === 'critical') {
    console.error('[SECURITY CRITICAL]', JSON.stringify(fullEvent))
  }
}

/**
 * Update security metrics
 */
function updateMetrics(eventType: SecurityEventType): void {
  switch (eventType) {
    case 'login_success':
      metrics.loginAttempts.success++
      break
    case 'login_failure':
      metrics.loginAttempts.failure++
      break
    case 'rate_limited':
      metrics.rateLimitHits++
      break
    case 'injection_attempt':
      metrics.injectionAttempts++
      break
    case 'csrf_violation':
      metrics.csrfViolations++
      break
    case 'ip_blocked':
      metrics.blockedRequests++
      break
    case 'suspicious_activity':
      metrics.suspiciousActivities++
      break
  }
}

/**
 * Get current security metrics
 */
export function getSecurityMetrics(): typeof metrics {
  return { ...metrics }
}

/**
 * Get recent security events
 */
export function getRecentEvents(count: number = 50, type?: SecurityEventType): SecurityEvent[] {
  let filtered = eventBuffer

  if (type) {
    filtered = filtered.filter(e => e.type === type)
  }

  return filtered.slice(-count).reverse()
}

/**
 * Get events by severity
 */
export function getEventsBySeverity(severity: SecurityEvent['severity'], count: number = 50): SecurityEvent[] {
  return eventBuffer
    .filter(e => e.severity === severity)
    .slice(-count)
    .reverse()
}

/**
 * Check for attack patterns
 */
export function detectAttackPattern(ip: string, windowMinutes: number = 5): {
  isAttack: boolean
  pattern?: string
  eventCount: number
} {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

  const recentEvents = eventBuffer.filter(
    e => e.ip === ip && e.timestamp >= windowStart
  )

  // Check for brute force
  const loginFailures = recentEvents.filter(e => e.type === 'login_failure')
  if (loginFailures.length >= 5) {
    return { isAttack: true, pattern: 'brute_force', eventCount: loginFailures.length }
  }

  // Check for injection attempts
  const injectionAttempts = recentEvents.filter(e => e.type === 'injection_attempt')
  if (injectionAttempts.length >= 3) {
    return { isAttack: true, pattern: 'injection_attack', eventCount: injectionAttempts.length }
  }

  // Check for general suspicious activity
  const highSeverity = recentEvents.filter(
    e => e.severity === 'high' || e.severity === 'critical'
  )
  if (highSeverity.length >= 5) {
    return { isAttack: true, pattern: 'coordinated_attack', eventCount: highSeverity.length }
  }

  return { isAttack: false, eventCount: recentEvents.length }
}

/**
 * Security alert thresholds
 */
const ALERT_THRESHOLDS = {
  loginFailuresPerHour: 50,
  rateLimitsPerHour: 100,
  injectionAttemptsPerHour: 10,
  csrfViolationsPerHour: 20
}

/**
 * Check if alerts should be triggered
 */
export function checkAlertThresholds(): {
  shouldAlert: boolean
  alerts: string[]
} {
  const hourAgo = new Date(Date.now() - 3600000)
  const recentEvents = eventBuffer.filter(e => e.timestamp >= hourAgo)

  const alerts: string[] = []

  const loginFailures = recentEvents.filter(e => e.type === 'login_failure').length
  if (loginFailures >= ALERT_THRESHOLDS.loginFailuresPerHour) {
    alerts.push(`High login failures: ${loginFailures} in last hour`)
  }

  const rateLimits = recentEvents.filter(e => e.type === 'rate_limited').length
  if (rateLimits >= ALERT_THRESHOLDS.rateLimitsPerHour) {
    alerts.push(`High rate limits: ${rateLimits} in last hour`)
  }

  const injections = recentEvents.filter(e => e.type === 'injection_attempt').length
  if (injections >= ALERT_THRESHOLDS.injectionAttemptsPerHour) {
    alerts.push(`Injection attempts detected: ${injections} in last hour`)
  }

  const csrfViolations = recentEvents.filter(e => e.type === 'csrf_violation').length
  if (csrfViolations >= ALERT_THRESHOLDS.csrfViolationsPerHour) {
    alerts.push(`CSRF violations: ${csrfViolations} in last hour`)
  }

  return {
    shouldAlert: alerts.length > 0,
    alerts
  }
}

/**
 * Get IP reputation based on past behavior
 */
export function getIPReputation(ip: string): {
  score: number // 0-100, higher is better
  recentEvents: number
  blockedCount: number
  lastSeen?: Date
} {
  const events = eventBuffer.filter(e => e.ip === ip)
  const blockedCount = events.filter(e => e.type === 'ip_blocked').length
  const badEvents = events.filter(
    e => ['injection_attempt', 'bot_detected', 'csrf_violation'].includes(e.type)
  ).length

  // Base score of 100
  let score = 100

  // Deduct for bad events
  score -= badEvents * 10
  score -= blockedCount * 20

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    recentEvents: events.length,
    blockedCount,
    lastSeen: events.length > 0 ? events[events.length - 1].timestamp : undefined
  }
}

/**
 * Log and record a security event from request
 */
export async function logSecurityEvent(
  request: NextRequest,
  type: SecurityEventType,
  severity: SecurityEvent['severity'],
  description: string,
  metadata?: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0].trim() || realIp || 'unknown'

  // Record in memory
  recordSecurityEvent({
    type,
    severity,
    ip,
    userId,
    description,
    metadata
  })

  // Also log to audit log for persistence
  await logSuspiciousActivity(request, description, { type, severity, ...metadata }, userId)
}

/**
 * Security dashboard data
 */
export function getSecurityDashboard(): {
  metrics: typeof metrics
  recentCritical: SecurityEvent[]
  topThreats: Array<{ ip: string; score: number; eventCount: number }>
  alertStatus: { shouldAlert: boolean; alerts: string[] }
} {
  // Get unique IPs from recent events
  const ipSet = new Set(eventBuffer.map(e => e.ip))
  const topThreats = Array.from(ipSet)
    .map(ip => ({
      ip,
      ...getIPReputation(ip)
    }))
    .filter(t => t.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map(t => ({ ip: t.ip, score: t.score, eventCount: t.recentEvents }))

  return {
    metrics: getSecurityMetrics(),
    recentCritical: getEventsBySeverity('critical', 10),
    topThreats,
    alertStatus: checkAlertThresholds()
  }
}
