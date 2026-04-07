// Security utilities barrel export

// IP resolution
export { getClientIP } from './ip'

// Rate limiting
export {
  checkRateLimit,
  rateLimit,
  createRateLimiter,
  addRateLimitHeaders,
  rateLimitConfigs,
  type RateLimitConfig,
  type RateLimitResult
} from './rate-limit'

// XSS protection
export {
  sanitizeText,
  sanitizeBasicHtml,
  sanitizeRichHtml,
  sanitizeEmailHtml,
  escapeHtml,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeSearchQuery,
  sanitizeObject,
  stripHtml,
  truncateText
} from './xss'

// CSRF protection
export {
  getOrCreateCsrfToken,
  setCsrfTokenCookie,
  validateCsrfToken,
  checkCsrf,
  csrfProtection,
  generateCsrfToken,
  getCsrfTokenFromCookies,
  isCsrfExempt,
  csrfExemptRoutes,
  type CsrfResult
} from './csrf'

// Audit logging
export {
  logAuditEvent,
  getRequestDetails,
  createAuditLogger,
  productAudit,
  orderAudit,
  categoryAudit,
  vendorAudit,
  userAudit,
  settingsAudit,
  couponAudit,
  dealAudit,
  logAuthEvent,
  logRateLimitViolation,
  logSuspiciousActivity,
  logFileUpload,
  type AuditLogEntry
} from './audit'

// Session security
export {
  getSessionTimeout,
  getMaxSessionAge,
  isSessionTimedOut,
  isSessionExpired,
  updateLastActivity,
  secureCookieOptions,
  setSecureSessionCookie,
  clearSessionCookie,
  forceLogout,
  isSessionInvalidated,
  validateSession,
  getClientIp,
  getUserAgent
} from './session'

// Threat detection
export {
  isIPBlocked,
  blockIP,
  isAccountLocked,
  getLockoutRemaining,
  recordFailedLogin,
  clearFailedLogins,
  detectSQLInjection,
  detectXSS,
  detectPathTraversal,
  scanForThreats,
  scanObjectForThreats,
  checkRequestRate,
  checkHoneypot,
  threatCheck,
  analyzeUserAgent,
  getHoneypotFields
} from './threat-detection'

// Request validation
export {
  validateContentLength,
  validateRequiredHeaders,
  validateContentType,
  validateOrigin,
  validateReferer,
  validateApiVersion,
  generateRequestFingerprint,
  validateRequest
} from './request-validation'

// Security monitoring
export {
  recordSecurityEvent,
  getSecurityMetrics,
  getRecentEvents,
  getEventsBySeverity,
  detectAttackPattern,
  checkAlertThresholds,
  getIPReputation,
  logSecurityEvent,
  getSecurityDashboard,
  type SecurityEventType,
  type SecurityEvent
} from './monitoring'
