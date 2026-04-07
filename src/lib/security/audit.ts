import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AuditLogEntry {
  userId?: string
  userEmail?: string
  userRole?: string
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
  notes?: string
  ipAddress?: string
  userAgent?: string
  requestMethod?: string
  requestPath?: string
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      user_email: entry.userEmail,
      user_role: entry.userRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      entity_name: entry.entityName,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      metadata: entry.metadata,
      notes: entry.notes,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      request_method: entry.requestMethod,
      request_path: entry.requestPath
    })
  } catch (error) {
    // Log to console but don't fail the main operation
    console.error('Failed to log audit event:', error, entry)
  }
}

/**
 * Extract request details for audit logging
 */
export function getRequestDetails(request: NextRequest): {
  ipAddress: string
  userAgent: string
  requestMethod: string
  requestPath: string
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  return {
    ipAddress: forwarded?.split(',')[0].trim() || realIp || '127.0.0.1',
    userAgent: request.headers.get('user-agent') || 'Unknown',
    requestMethod: request.method,
    requestPath: request.nextUrl.pathname
  }
}

/**
 * Create an audit logger for a specific entity type
 */
export function createAuditLogger(entityType: string) {
  return {
    async logCreate(
      request: NextRequest,
      user: { id: string; email: string; role: string },
      entityId: string,
      entityName: string,
      newValues: Record<string, unknown>
    ) {
      const requestDetails = getRequestDetails(request)
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'create',
        entityType,
        entityId,
        entityName,
        newValues,
        ...requestDetails
      })
    },

    async logUpdate(
      request: NextRequest,
      user: { id: string; email: string; role: string },
      entityId: string,
      entityName: string,
      oldValues: Record<string, unknown>,
      newValues: Record<string, unknown>
    ) {
      const requestDetails = getRequestDetails(request)
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'update',
        entityType,
        entityId,
        entityName,
        oldValues,
        newValues,
        ...requestDetails
      })
    },

    async logDelete(
      request: NextRequest,
      user: { id: string; email: string; role: string },
      entityId: string,
      entityName: string,
      oldValues?: Record<string, unknown>
    ) {
      const requestDetails = getRequestDetails(request)
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'delete',
        entityType,
        entityId,
        entityName,
        oldValues,
        ...requestDetails
      })
    },

    async logAction(
      request: NextRequest,
      user: { id: string; email: string; role: string },
      action: string,
      entityId?: string,
      entityName?: string,
      metadata?: Record<string, unknown>
    ) {
      const requestDetails = getRequestDetails(request)
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action,
        entityType,
        entityId,
        entityName,
        metadata,
        ...requestDetails
      })
    }
  }
}

// Pre-configured audit loggers for common entities
export const productAudit = createAuditLogger('product')
export const orderAudit = createAuditLogger('order')
export const categoryAudit = createAuditLogger('category')
export const vendorAudit = createAuditLogger('vendor')
export const userAudit = createAuditLogger('user')
export const settingsAudit = createAuditLogger('settings')
export const couponAudit = createAuditLogger('coupon')
export const dealAudit = createAuditLogger('deal')

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'password_changed',
  userEmail: string,
  request: NextRequest,
  userId?: string,
  metadata?: Record<string, unknown>
) {
  const requestDetails = getRequestDetails(request)
  await logAuditEvent({
    userId,
    userEmail,
    action,
    entityType: 'auth',
    metadata,
    ...requestDetails
  })
}

/**
 * Log rate limit violations
 */
export async function logRateLimitViolation(
  request: NextRequest,
  endpoint: string,
  ipAddress: string,
  userId?: string
) {
  const requestDetails = getRequestDetails(request)
  await logAuditEvent({
    userId,
    action: 'rate_limit_exceeded',
    entityType: 'security',
    metadata: {
      endpoint,
      ipAddress
    },
    ...requestDetails
  })
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  request: NextRequest,
  description: string,
  metadata?: Record<string, unknown>,
  userId?: string
) {
  const requestDetails = getRequestDetails(request)
  await logAuditEvent({
    userId,
    action: 'suspicious_activity',
    entityType: 'security',
    notes: description,
    metadata,
    ...requestDetails
  })
}

/**
 * Log file upload events
 */
export async function logFileUpload(
  request: NextRequest,
  user: { id: string; email: string; role: string },
  filename: string,
  fileSize: number,
  fileType: string,
  storagePath: string
) {
  const requestDetails = getRequestDetails(request)
  await logAuditEvent({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: 'upload',
    entityType: 'file',
    entityName: filename,
    metadata: {
      fileSize,
      fileType,
      storagePath
    },
    ...requestDetails
  })
}
