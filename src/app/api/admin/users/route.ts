import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  role: z.enum(['buyer', 'seller', 'admin']).nullish(),
  search: z.string().trim().max(200).nullish(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    role: searchParams.get('role'),
    search: searchParams.get('search'),
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid query', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { role, search, limit, offset } = parsed.data

  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })

  if (role) {
    query = query.eq('role', role)
  }

  if (search) {
    const sanitized = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`display_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to fetch users' } }, { status: 500 })
  }

  return NextResponse.json({ data: data || [], meta: { total: count || 0, limit, offset } })
}
