import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { captureError } from '@/lib/error-tracking'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  q: z.string().max(200).default(''),
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'rating', 'popular']).default('relevance'),
  category: z.string().trim().max(100).regex(/^[a-z0-9-]+$/).nullish(),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
})

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const parsed = querySchema.safeParse({
    q: searchParams.get('q') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    category: searchParams.get('category'),
    minPrice: searchParams.get('minPrice') ?? undefined,
    maxPrice: searchParams.get('maxPrice') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid query', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { page, limit, sort: sortBy, category, minPrice, maxPrice } = parsed.data
  const rawQuery = parsed.data.q
  const query = rawQuery

  const offset = Math.min((page - 1) * limit, 5000)
  const supabase = getSupabaseAdmin()

  try {
    let dbQuery = supabase
      .from('products')
      .select('*, seller:users(display_name, avatar_url), category:categories(id, name, slug)', { count: 'exact' })
      .eq('status', 'approved')

    // Text search
    if (query) {
      const sanitized = query.replace(/[%_\\]/g, '\\$&').replace(/[.,()<>'";\[\]{}|]/g, '')
      dbQuery = dbQuery.or(`title.ilike.%${sanitized}%,short_description.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }

    // Category filter by slug
    if (category) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single()

      if (categoryData) {
        dbQuery = dbQuery.eq('category_id', categoryData.id)
      }
    }

    // Price filters (in cents)
    if (minPrice !== undefined) {
      dbQuery = dbQuery.gte('price_cents', minPrice)
    }
    if (maxPrice !== undefined) {
      dbQuery = dbQuery.lte('price_cents', maxPrice)
    }

    // Sorting
    switch (sortBy) {
      case 'price_asc':
        dbQuery = dbQuery.order('price_cents', { ascending: true })
        break
      case 'price_desc':
        dbQuery = dbQuery.order('price_cents', { ascending: false })
        break
      case 'rating':
        dbQuery = dbQuery.order('avg_rating', { ascending: false })
        break
      case 'popular':
        dbQuery = dbQuery.order('download_count', { ascending: false })
        break
      case 'newest':
        dbQuery = dbQuery.order('created_at', { ascending: false })
        break
      default: // relevance
        dbQuery = dbQuery.order('created_at', { ascending: false })
    }

    const { data: products, error, count } = await dbQuery.range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({
        data: [],
        meta: { total: 0, page, totalPages: 0, query: '' },
      })
    }

    // Get categories for facets
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, slug')
      .order('sort_order')

    const safeQuery = query.replace(/[<>"'&]/g, '')

    return NextResponse.json({
      data: products || [],
      meta: {
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        query: safeQuery,
      },
      facets: {
        categories: categories || [],
      },
    })
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      context: 'api:search',
      extra: { query: rawQuery?.slice(0, 50) },
    })
    return NextResponse.json({ error: { message: 'Search failed' } }, { status: 500 })
  }
}
