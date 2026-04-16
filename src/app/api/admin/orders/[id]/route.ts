import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'completed', 'refunded', 'failed']),
}).strict()

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:users!orders_buyer_id_fkey(display_name, email), product:products(title, slug), license:licenses(*)')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const { id } = await params
  const parsed = updateOrderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid payload', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { status } = parsed.data

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to update order' } }, { status: 500 })
  }

  return NextResponse.json({ data })
}
