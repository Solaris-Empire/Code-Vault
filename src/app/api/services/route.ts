// /api/services — seller hire-marketplace listings.
// GET  — public list of approved services (with filters).
// POST — authenticated seller creates a new service.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { CreateServiceSchema } from '@/lib/services/validation'
import { slugify } from '@/lib/utils/format'
import { captureError } from '@/lib/error-tracking'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const listQuerySchema = z.object({
  tier: z.enum(['vibe', 'real']).nullish(),
  category: z.string().trim().max(100).regex(/^[a-z0-9-]+$/).nullish(),
  search: z.string().trim().max(200).nullish(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating', 'popular']).default('newest'),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

// ─── GET /api/services ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    tier: searchParams.get('tier'),
    category: searchParams.get('category'),
    search: searchParams.get('search'),
    sort: searchParams.get('sort') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid query', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { tier, category: categorySlug, search, sort, limit, offset } = parsed.data

  try {
    const admin = getSupabaseAdmin()
    let query = admin
      .from('seller_services')
      .select(
        `id, seller_id, tier, category_id, title, slug, short_description, description,
         thumbnail_url, tags, pricing_model, price_cents, hourly_rate_cents, min_hours,
         delivery_days, revisions_included, status, order_count, avg_rating, review_count, created_at,
         seller:users!seller_services_seller_id_fkey(id, display_name, avatar_url, seller_tier),
         category:categories!seller_services_category_id_fkey(name, slug)`,
        { count: 'exact' },
      )
      .eq('status', 'approved')

    if (tier === 'vibe' || tier === 'real') query = query.eq('tier', tier)
    if (search) query = query.ilike('title', `%${search}%`)
    if (categorySlug) {
      const { data: cat } = await admin.from('categories').select('id').eq('slug', categorySlug).single()
      if (cat) query = query.eq('category_id', cat.id)
    }

    switch (sort) {
      case 'price_asc': query = query.order('price_cents', { ascending: true }); break
      case 'price_desc': query = query.order('price_cents', { ascending: false }); break
      case 'rating': query = query.order('avg_rating', { ascending: false, nullsFirst: false }); break
      case 'popular': query = query.order('order_count', { ascending: false }); break
      default: query = query.order('created_at', { ascending: false })
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    return NextResponse.json({
      data: data || [],
      meta: { total: count || 0, limit, offset },
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), { context: 'api:services:get' })
    return NextResponse.json({ error: { message: 'Failed to fetch services' } }, { status: 500 })
  }
}

// ─── POST /api/services ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Throttle service creation to stop spam listings.
  const rl = await checkRateLimit(request, rateLimitConfigs.upload)
  if (!rl.allowed) return rl.error!

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('users')
    .select('role, seller_tier, display_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: { message: 'Seller account required' } }, { status: 403 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = CreateServiceSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid service payload', details: parsed.error.issues } },
      { status: 400 },
    )
  }
  const input = parsed.data

  // Real Coder tier gate — DB trigger backstops this, but reject early with
  // a readable message before hitting Postgres.
  if (input.tier === 'real' && !['pro', 'elite'].includes(profile.seller_tier || '')) {
    return NextResponse.json(
      { error: { message: 'Real Coder listings require Pro or Elite seller tier. Keep shipping great products to unlock it.' } },
      { status: 403 },
    )
  }

  if (input.pricingModel === 'hourly' && !input.hourlyRateCents) {
    return NextResponse.json(
      { error: { message: 'Hourly listings must include an hourly rate.' } },
      { status: 400 },
    )
  }

  const slug = await makeUniqueSlug(input.title)

  try {
    const { data, error } = await admin
      .from('seller_services')
      .insert({
        seller_id: user.id,
        tier: input.tier,
        category_id: input.categoryId || null,
        title: input.title,
        slug,
        short_description: input.shortDescription || null,
        description: input.description,
        thumbnail_url: input.thumbnailUrl || null,
        tags: input.tags && input.tags.length > 0 ? input.tags : null,
        pricing_model: input.pricingModel,
        price_cents: input.priceCents,
        hourly_rate_cents: input.hourlyRateCents || null,
        min_hours: input.minHours || null,
        delivery_days: input.deliveryDays,
        revisions_included: input.revisionsIncluded,
        status: input.submitForReview ? 'pending' : 'draft',
      })
      .select('id, slug, status')
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), { context: 'api:services:post' })
    const message = err instanceof Error ? err.message : 'Failed to create service'
    const isTierGate = message.toLowerCase().includes('pro or elite')
    return NextResponse.json(
      { error: { message } },
      { status: isTierGate ? 403 : 500 },
    )
  }
}

// ─── helpers ───────────────────────────────────────────────────────

async function makeUniqueSlug(title: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const base = slugify(title).slice(0, 60) || 'service'

  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const { data } = await admin.from('seller_services').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
  }
  // Fall back to a timestamp-suffixed slug.
  return `${base}-${Date.now().toString(36)}`
}
