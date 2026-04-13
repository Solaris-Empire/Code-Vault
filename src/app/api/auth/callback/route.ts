import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Only accept same-origin paths for the post-login redirect. An absolute
// URL here would be an open-redirect phishing vector: an attacker crafts
// /api/auth/callback?code=...&redirectTo=https://evil.com and users land
// on evil.com already-authenticated and primed to trust it.
function safeRedirectPath(raw: string | null): string {
  if (!raw) return '/'
  // Must start with a single `/` and not a protocol-relative `//` or a
  // backslash that some browsers normalise to `/`.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = safeRedirectPath(searchParams.get('redirectTo'))

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Profile is auto-created by the handle_new_user DB trigger.
      // Fallback: if profile is missing (race condition), create via admin client.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        const metaRole = user.user_metadata?.role === 'seller' ? 'seller' : 'buyer'
        const { createClient } = await import('@supabase/supabase-js')
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        if (!profile) {
          await admin.from('users').upsert({
            id: user.id,
            email: user.email || '',
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
            avatar_url: user.user_metadata?.avatar_url || null,
            role: metaRole,
          }, { onConflict: 'id' })
        } else if (metaRole === 'seller') {
          await admin.from('users').update({ role: 'seller' }).eq('id', user.id).eq('role', 'buyer')
        }
      }

      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
