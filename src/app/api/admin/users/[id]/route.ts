import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const updateUserSchema = z.object({
  role: z.enum(['buyer', 'seller', 'admin']),
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
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: { message: 'User not found' } }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin()
  if (!caller) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const { id } = await params
  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid payload', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { role } = parsed.data

  // Block self-demotion. An admin editing themselves down to buyer/seller
  // is almost always a mistake — and with a single-admin setup it bricks
  // admin access permanently. Explicit role changes to yourself must go
  // through another admin.
  if (caller.id === id && role !== 'admin') {
    return NextResponse.json(
      { error: { message: 'You cannot change your own admin role. Ask another admin.' } },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to update user' } }, { status: 500 })
  }

  return NextResponse.json({ data })
}
