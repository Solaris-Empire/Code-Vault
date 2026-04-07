import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

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
  const productId = searchParams.get('product_id')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!productId) {
    return NextResponse.json({ error: { message: 'Product ID is required' } }, { status: 400 })
  }

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
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: { message: 'Sign in to leave a review' } }, { status: 401 })
  }

  const body = await request.json()
  const { product_id, rating, comment } = body

  if (!product_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: { message: 'Product ID and rating (1-5) are required' } }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Check if already reviewed
  const { data: existing } = await supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('product_id', product_id)
    .eq('buyer_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: { message: 'You have already reviewed this product' } }, { status: 400 })
  }

  // Check if user has a completed order for this product
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('product_id', product_id)
    .eq('status', 'completed')
    .limit(1)
    .single()

  if (!order) {
    return NextResponse.json({ error: { message: 'You must purchase this product before reviewing' } }, { status: 403 })
  }

  const { data: review, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      product_id,
      buyer_id: user.id,
      rating,
      comment: comment?.slice(0, 2000) || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to submit review' } }, { status: 500 })
  }

  return NextResponse.json({ data: review })
}
