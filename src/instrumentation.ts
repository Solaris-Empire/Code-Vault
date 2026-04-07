export async function register() {
  // Initialize Sentry for server-side error tracking
  const Sentry = await import('@sentry/nextjs')
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      enabled: true,
      beforeSend(event) {
        if (event.exception?.values?.[0]?.type === 'NotFoundError') {
          return null
        }
        return event
      },
    })
    console.log('[startup] Sentry initialized for', process.env.NEXT_RUNTIME || 'unknown runtime')
  } else {
    console.warn('[startup] Sentry DSN not found, error tracking disabled')
  }

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}\n\nSee .env.example for reference.`
    )
  }

  const recommended = [
    'RESEND_API_KEY',
    'CRON_SECRET',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
  ]

  const missingRecommended = recommended.filter((key) => !process.env[key])

  if (missingRecommended.length > 0) {
    console.warn(
      `[startup] Missing recommended env variables (some features will be disabled):\n  ${missingRecommended.join('\n  ')}`
    )
  }

  // Security: Validate CRON_SECRET strength
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret.length < 32) {
    console.warn(
      '[security] CRON_SECRET is too short (< 32 chars). Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  // Security: Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.startsWith('https://') && process.env.NODE_ENV === 'production') {
    console.warn('[security] NEXT_PUBLIC_SUPABASE_URL should use HTTPS in production')
  }

  // Security: Validate Stripe keys match environment
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && process.env.NODE_ENV === 'production' && stripeKey.startsWith('sk_test_')) {
    console.warn('[security] Using Stripe test key in production environment')
  }

  // Enterprise: Register global error handler (Node.js only, not Edge)
  // @ts-ignore - EdgeRuntime is a global in Vercel Edge Runtime
  if (typeof process !== 'undefined' && typeof process.on === 'function' && typeof globalThis.EdgeRuntime === 'undefined') {
    process.on('unhandledRejection', (reason) => {
      console.error('[fatal] Unhandled promise rejection:', reason)
    })

    process.on('uncaughtException', (error) => {
      console.error('[fatal] Uncaught exception:', error)
    })
  }

  // Enterprise: Log startup info
  console.log(`[startup] UK Grocery Store v${process.env.npm_package_version || '0.1.0'}`)
  console.log(`[startup] Environment: ${process.env.NODE_ENV}`)
  console.log(`[startup] Node: ${process.version}`)
  console.log(`[startup] Cache: in-memory (set REDIS_URL for Redis)`)
  console.log(`[startup] Queue: in-memory (set REDIS_URL for BullMQ)`)
}
