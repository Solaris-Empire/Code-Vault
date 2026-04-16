import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid slug'),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(100).nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).max(1_000_000).optional(),
}).strict()

// GET all categories (public)
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*, parent:parent_id(*)')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to fetch categories' } }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// Verify admin role
async function requireAdminAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

// POST - Create category (admin only)
export async function POST(request: NextRequest) {
  const user = await requireAdminAuth()
  if (!user) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const parsed = createCategorySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid payload', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { name, slug, description, icon, parent_id, sort_order } = parsed.data

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({ name, slug, description: description || null, icon: icon || null, parent_id: parent_id || null, sort_order: sort_order || 0 })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: { message: 'Category with this slug already exists' } }, { status: 409 })
      }
      return NextResponse.json({ error: { message: 'Failed to create category' } }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }
}
