/**
 * Client-side security utilities
 * Use these in React components and client-side API calls
 */

const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_COOKIE_NAME = 'csrf_token'

/**
 * Get CSRF token from cookie (double-submit cookie pattern)
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      return value
    }
  }
  return null
}

/**
 * Create headers object with CSRF token included
 * Use this for all POST/PUT/DELETE API requests
 */
export function getSecureHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  const csrfToken = getCsrfToken()

  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
    ...additionalHeaders
  }
}

/**
 * Install a global fetch interceptor that automatically adds
 * the CSRF token header to all same-origin POST/PUT/DELETE/PATCH requests.
 * Call this once at app startup (e.g. in a root layout provider).
 */
export function installCsrfInterceptor(): void {
  if (typeof window === 'undefined') return

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || 'GET').toUpperCase()
    const isUnsafe = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

    if (isUnsafe) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        const headers = new Headers(init?.headers)
        // Only add if not already set
        if (!headers.has(CSRF_HEADER_NAME)) {
          headers.set(CSRF_HEADER_NAME, csrfToken)
        }
        init = { ...init, headers }
      }
    }

    return originalFetch(input, init)
  }
}
