import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { captureError } from '@/lib/error-tracking'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawQuery = searchParams.get('q') || ''
  const query = rawQuery.slice(0, 200)
  const page = Math.min(Math.max(parseInt(searchParams.get('page') || '1') || 1, 1), 100)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 50)
  const sortBy = searchParams.get('sort') || 'relevance'
  const category = searchParams.get('category')
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')

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
    if (minPrice) {
      dbQuery = dbQuery.gte('price_cents', parseInt(minPrice))
    }
    if (maxPrice) {
      dbQuery = dbQuery.lte('price_cents', parseInt(maxPrice))
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
