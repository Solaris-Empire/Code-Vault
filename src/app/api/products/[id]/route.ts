import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET single product by ID or slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  // Try by UUID first, then by slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const query = supabaseAdmin
    .from('products')
    .select('*, seller:users(id, display_name, avatar_url, bio), category:categories(id, name, slug), files:product_files(*)')

  const { data, error } = isUuid
    ? await query.eq('id', id).single()
    : await query.eq('slug', id).single()

  if (error || !data) {
    return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 })
  }

  return NextResponse.json({ data })
}

// PUT update product (seller who owns it, or admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  // Check authorization: must be seller (owner) or admin
  const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  const { data: product } = await supabaseAdmin.from('products').select('seller_id').eq('id', id).single()

  if (!product) {
    return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 })
  }

  const isOwner = product.seller_id === user.id
  const isAdmin = userProfile?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const body = await request.json()

  // Sellers can update these fields
  const sellerFields = ['title', 'slug', 'description', 'short_description', 'price_cents', 'category_id', 'demo_url', 'thumbnail_url', 'tags']
  // Admins can also update these
  const adminFields = [...sellerFields, 'status', 'is_featured']

  const allowedFields = isAdmin ? adminFields : sellerFields
  const updateData: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  // If seller updates content, reset status to pending for re-review
  if (isOwner && !isAdmin && Object.keys(updateData).some(k => ['title', 'description', 'short_description'].includes(k))) {
    updateData.status = 'pending'
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to update product' } }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE product (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()

  if (userProfile?.role !== 'admin') {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const { id } = await params
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      // Has orders referencing it — set status to rejected instead
      await supabaseAdmin.from('products').update({ status: 'rejected' }).eq('id', id)
      return NextResponse.json({ data: { success: true, softDeleted: true } })
    }
    return NextResponse.json({ error: { message: 'Failed to delete product' } }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
