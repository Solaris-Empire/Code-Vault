// Admin on-demand GitHub hunt — Sprint 2.3.
// Admin-only endpoint. Takes a raw GitHub code-search query (e.g.
// `filename:foo.ts`, `"unique-token" in:file`, `path:src/weird-folder`)
// and returns matches with confidence + meta so we can manually
// triage suspected stolen listings.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { huntGithub } from '@/lib/analysis/github-match'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  query: z.string().min(3).max(256),
})

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } },
  )
}

async function isAdmin(): Promise<boolean> {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 403 })
  }

  const raw = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid body', details: parsed.error.issues } },
      { status: 400 },
    )
  }

  try {
    const result = await huntGithub(parsed.data.query)
    return NextResponse.json({ data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: { message: msg } }, { status: 500 })
  }
}
