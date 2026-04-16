import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { awardSellerXp, XP_REWARDS } from '@/lib/seller/rank'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// HTTPS-only URL validator — blocks ftp/file/data/javascript schemes
// that `.url()` alone would accept and that would turn into XSS or
// phishing when a product page renders the value.
const httpsUrl = z
  .string()
  .url()
  .max(500)
  .refine((u) => u.startsWith('https://'), { message: 'URL must be HTTPS' })

// Whitelists exactly which fields are accepted, and their shapes. Anything
// else in the body (incl. seller_id, download_count, stripe ids, etc.) is
// silently dropped by Zod before we hand it to Supabase.
const licensePricesSchema = z
  .object({
    personal: z.number().int().min(0).max(10_000_000).optional(),
    commercial: z.number().int().min(0).max(10_000_000).optional(),
    extended: z.number().int().min(0).max(10_000_000).optional(),
  })
  .strict()
  .nullable()

const sellerFieldsSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9-]+$/, 'Invalid slug').optional(),
  description: z.string().trim().min(1).max(50_000).optional(),
  short_description: z.string().trim().max(500).nullable().optional(),
  price_cents: z.number().int().min(0).max(10_000_000).optional(),
  license_prices_cents: licensePricesSchema.optional(),
  category_id: z.string().uuid().nullable().optional(),
  demo_url: httpsUrl.nullable().optional(),
  thumbnail_url: httpsUrl.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).nullable().optional(),
  show_ai_detection: z.boolean().optional(),
})

const adminFieldsSchema = sellerFieldsSchema.extend({
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
  is_featured: z.boolean().optional(),
})

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
  const rl = await checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  // Check authorization: must be seller (owner) or admin
  const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  const { data: product } = await supabaseAdmin.from('products').select('seller_id, status').eq('id', id).single()

  if (!product) {
    return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 })
  }

  const isOwner = product.seller_id === user.id
  const isAdmin = userProfile?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body' } }, { status: 400 })
  }

  const schema = isAdmin ? adminFieldsSchema : sellerFieldsSchema
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid product update payload',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    )
  }

  const updateData: Record<string, unknown> = { ...parsed.data }

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

  // Award XP on admin approval transition (pending/rejected → approved).
  // Fire-and-forget — XP must never block the admin moderation flow.
  if (
    isAdmin &&
    updateData.status === 'approved' &&
    product.status !== 'approved'
  ) {
    awardSellerXp({
      sellerId: product.seller_id,
      eventType: 'product_approved',
      xpDelta: XP_REWARDS.PRODUCT_APPROVED,
      dedupKey: `product:${id}:approved`,
      sourceTable: 'products',
      sourceId: id,
    }).catch(() => {})
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
