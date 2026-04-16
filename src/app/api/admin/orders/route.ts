import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  status: z.enum(['pending', 'completed', 'refunded', 'failed']).nullish(),
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
    status: searchParams.get('status'),
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid query', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { status, limit, offset } = parsed.data

  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('orders')
    .select('*, buyer:users!orders_buyer_id_fkey(display_name, email), product:products(title, slug)', { count: 'exact' })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to fetch orders' } }, { status: 500 })
  }

  return NextResponse.json({ data: data || [], meta: { total: count || 0, limit, offset } })
}
