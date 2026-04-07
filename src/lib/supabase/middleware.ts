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

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip security checks for static assets
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2)$/)) {
    return NextResponse.next({ request })
  }

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
    const rateLimit = checkRateLimit(request, rateLimitConfigs.auth)
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

  // Rate limiting for upload endpoints (strict)
  if (pathname.startsWith('/api/upload')) {
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.sensitive)
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
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.api)
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
    const rateLimitResult = checkRateLimit(request, rateLimitConfigs.api)
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
    request,
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
            request,
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
      .from('profiles')
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
            .from('profiles')
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

  return supabaseResponse
}
