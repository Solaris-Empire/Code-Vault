import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  try {
    const body = await request.json()
    const { name, slug, description, icon, parent_id, sort_order } = body

    if (!name || typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: { message: 'Valid name required (max 200 chars)' } }, { status: 400 })
    }
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: { message: 'Valid slug required (lowercase, numbers, hyphens)' } }, { status: 400 })
    }

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
