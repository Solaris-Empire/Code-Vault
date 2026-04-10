export async function register() {
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
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
  ]

  const missingRecommended = recommended.filter((key) => !process.env[key])

  if (missingRecommended.length > 0) {
    console.warn(
      `[startup] Missing recommended env variables (some features will be disabled):\n  ${missingRecommended.join('\n  ')}`
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

  console.log(`[startup] CodeVault v${process.env.npm_package_version || '0.1.0'}`)
  console.log(`[startup] Environment: ${process.env.NODE_ENV}`)
}
