import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  checkRateLimit,
  rateLimitConfigs,
  addRateLimitHeaders,
  checkCsrf,
  isCsrfExempt,
  setCsrfTokenCookie,
  generateCsrfToken,
  logRateLimitViolation,
  threatCheck,
  validateContentLength,
  recordSecurityEvent,
  logSecurityEvent
} from '@/lib/security'

// Build the CSP header string for this request. A fresh nonce is minted
// per request and threaded into script-src via 'strict-dynamic' so
// Next.js's bootstrap chunks (and anything they transitively load — e.g.
// Stripe.js) execute, while any attacker-injected inline <script> without
// the nonce is blocked. 'unsafe-inline' + https: are kept as fallbacks
// for old browsers; modern browsers that understand 'strict-dynamic'
// ignore them.
function buildCsp(nonce: string): string {
  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host
    } catch {
      return ''
    }
  })()

  const supabaseDirective = supabaseHost ? `https://${supabaseHost}` : ''
  const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : ''

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${supabaseDirective} https://*.stripe.com https://images.unsplash.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${supabaseDirective} ${supabaseWs} https://*.stripe.com https://api.github.com https://api.osv.dev`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://connect-js.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.stripe.com",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip security checks for static assets
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2)$/)) {
    return NextResponse.next({ request })
  }

  // Per-request nonce for script-src. Must be generated *before* any
  // response is built so the same value ends up on the request header
  // (picked up by Next.js for its bootstrap scripts and readable via
  // `headers()` in Server Components) and on the CSP response header.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Propagate CSP via request header too — Next.js strips this before
  // forwarding and uses it to pick up the nonce for inline bootstrap.
  requestHeaders.set('content-security-policy', csp)

  // Threat detection for API routes (skip webhooks - they use their own signature verification)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/')) {
    // Validate request size
    const sizeCheck = validateContentLength(request)
    if (!sizeCheck.valid && sizeCheck.error) {
      return sizeCheck.error
    }

    // Run threat detection
    const threatResult = await threatCheck(request)
    if (!threatResult.safe && threatResult.error) {
      // Log the threat
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded?.split(',')[0].trim() || 'unknown'
      recordSecurityEvent({
        type: 'injection_attempt',
        severity: 'high',
        ip,
        description: `Threat detected: ${threatResult.threats?.join(', ')}`,
        metadata: { path: pathname, threats: threatResult.threats }
      })
      return threatResult.error
    }
  }

  // Rate limiting for auth endpoints
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/auth')) {
    const rateLimit = await checkRateLimit(request, rateLimitConfigs.auth)
    if (!rateLimit.allowed) {
      // Log rate limit violation
      logRateLimitViolation(request, pathname, rateLimit.identifier)
      const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimit)
    }
  }

  // Rate limiting for upload endpoints
  if (pathname.startsWith('/api/upload')) {
    const rateLimitResult = await checkRateLimit(request, rateLimitConfigs.upload)
    if (!rateLimitResult.allowed) {
      logRateLimitViolation(request, pathname, rateLimitResult.identifier)
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }
  }

  // Rate limiting for admin endpoints (use general API limits, not sensitive)
  if (pathname.startsWith('/api/admin')) {
    const rateLimitResult = await checkRateLimit(request, rateLimitConfigs.api)
    if (!rateLimitResult.allowed) {
      logRateLimitViolation(request, pathname, rateLimitResult.identifier)
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }
  }

  // Rate limiting for general API endpoints (search, products, etc.)
  // Skip webhooks - they use their own signature verification and can burst
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/upload') && !pathname.startsWith('/api/webhooks/')) {
    const rateLimitResult = await checkRateLimit(request, rateLimitConfigs.api)
    if (!rateLimitResult.allowed) {
      logRateLimitViolation(request, pathname, rateLimitResult.identifier)
      const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }
  }

  // CSRF protection for API POST/PUT/DELETE requests
  if (pathname.startsWith('/api/') && !isCsrfExempt(pathname)) {
    const method = request.method
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrfResult = await checkCsrf(request)
      if (!csrfResult.valid && csrfResult.error) {
        return csrfResult.error
      }
    }
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/account', '/checkout']
  const adminPaths = ['/admin', '/api/admin']
  const authPaths = ['/login', '/register']

  // Redirect unauthenticated users from protected routes
  if (!user && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Routes that handle their own auth (CRON_SECRET, etc.)
  const selfAuthRoutes = ['/api/admin/seed-accounts', '/api/admin/seed-products', '/api/admin/seed-categories', '/api/admin/fix-products']
  const isSelfAuth = selfAuthRoutes.some(r => pathname.startsWith(r))

  // Block unauthenticated users from admin routes (except self-auth routes)
  if (!user && !isSelfAuth && adminPaths.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from auth pages
  if (user && authPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Check admin access using service role to bypass RLS
  if (user && !isSelfAuth && adminPaths.some((p) => pathname.startsWith(p))) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'super_admin'].includes(profile?.role || '')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Maintenance mode check — block public pages for non-admin users
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  const isVendorRoute = pathname.startsWith('/vendor') || pathname.startsWith('/api/vendor')
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/api/auth')
  const isApiRoute = pathname.startsWith('/api/')
  const isMaintenancePage = pathname === '/maintenance'
  const isStaticOrInternal = pathname.startsWith('/_next') || pathname.startsWith('/api/health') || pathname.startsWith('/api/webhooks')

  if (!isAdminRoute && !isAuthRoute && !isMaintenancePage && !isStaticOrInternal) {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: maintenanceSetting } = await supabaseAdmin
        .from('store_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single()

      if (maintenanceSetting?.value === 'true') {
        // Check if user is admin — admins can still browse
        let isAdmin = false
        if (user) {
          const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          isAdmin = ['admin', 'super_admin'].includes(profile?.role || '')
        }

        if (!isAdmin) {
          if (isApiRoute) {
            return NextResponse.json(
              { error: 'Site is under maintenance. Please try again later.' },
              { status: 503 }
            )
          }
          const url = request.nextUrl.clone()
          url.pathname = '/maintenance'
          return NextResponse.redirect(url)
        }
      }
    } catch {
      // If check fails, don't block — fail open
    }
  }

  // Set CSRF token cookie if not present, and expose via response header
  if (!request.cookies.get('csrf_token')) {
    const csrfToken = await generateCsrfToken()
    supabaseResponse = setCsrfTokenCookie(supabaseResponse, csrfToken)
    supabaseResponse.headers.set('x-csrf-token', csrfToken)
  }

  // Shipping as Report-Only first — violations are logged to the browser
  // console but nothing is blocked. Flip to `Content-Security-Policy`
  // (drop `-Report-Only`) once we've verified no legitimate scripts are
  // getting flagged in prod. A wrongly-tight enforcing CSP would blank
  // the entire app.
  supabaseResponse.headers.set('Content-Security-Policy-Report-Only', csp)

  return supabaseResponse
}
