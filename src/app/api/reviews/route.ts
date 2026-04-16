import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).nullable().optional(),
})

const listQuerySchema = z.object({
  product_id: z.string().uuid(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

// GET reviews for a product
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const parsed = listQuerySchema.safeParse({
    product_id: searchParams.get('product_id'),
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid query', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { product_id: productId, page, limit } = parsed.data

  const supabaseAdmin = getSupabaseAdmin()
  const offset = (page - 1) * limit

  const { data: reviews, error, count } = await supabaseAdmin
    .from('reviews')
    .select('*, buyer:users(display_name, avatar_url)', { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to fetch reviews' } }, { status: 500 })
  }

  // Rating breakdown
  const { data: ratingData } = await supabaseAdmin
    .from('reviews')
    .select('rating')
    .eq('product_id', productId)

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  ratingData?.forEach((r: { rating: number }) => {
    breakdown[r.rating as keyof typeof breakdown]++
  })

  return NextResponse.json({
    data: reviews || [],
    meta: { total: count || 0, page, totalPages: Math.ceil((count || 0) / limit) },
    breakdown,
  })
}

// POST - Submit a review (must own the product via completed order)
export async function POST(request: NextRequest) {
  // Per-IP throttle — stops review flooding from scripted accounts.
  const rl = await checkRateLimit(request, rateLimitConfigs.review)
  if (!rl.allowed) return rl.error!

  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: { message: 'Sign in to leave a review' } }, { status: 401 })
  }

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid review payload', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { product_id, rating, comment } = parsed.data

  const supabaseAdmin = getSupabaseAdmin()

  // Check if user has a completed, non-refunded order for this product.
  // Refunded orders do NOT grant review rights.
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('product_id', product_id)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: { message: 'You must purchase this product before reviewing' } }, { status: 403 })
  }

  // Insert the review. The (product_id, buyer_id) UNIQUE constraint on the
  // reviews table is the source of truth for "already reviewed" — a raw
  // SELECT-then-INSERT has a TOCTOU race. We catch 23505 and return 409.
  const { data: review, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      product_id,
      buyer_id: user.id,
      rating,
      comment: comment ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: { message: 'You have already reviewed this product' } },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: { message: 'Failed to submit review' } }, { status: 500 })
  }

  return NextResponse.json({ data: review })
}
