import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { captureError } from '@/lib/error-tracking'

export const dynamic = 'force-dynamic'

// GET approved products with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const featured = searchParams.get('featured') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const sort = searchParams.get('sort') || 'newest'

  try {
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('products')
      .select('*, seller:users(display_name, avatar_url), category:categories(name, slug)', { count: 'exact' })
      .eq('status', 'approved')

    if (category) {
      // Filter by category slug via subquery
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single()

      if (cat) {
        query = query.eq('category_id', cat.id)
      }
    }

    if (featured) {
      query = query.eq('is_featured', true)
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        query = query.order('price_cents', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price_cents', { ascending: false })
        break
      case 'rating':
        query = query.order('avg_rating', { ascending: false })
        break
      case 'popular':
        query = query.order('download_count', { ascending: false })
        break
      default: // newest
        query = query.order('created_at', { ascending: false })
    }

    const { data: products, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      data: products || [],
      meta: { total: count || 0, limit, offset },
    })
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      context: 'api:products:get',
    })
    return NextResponse.json({ error: { message: 'Failed to fetch products' } }, { status: 500 })
  }
}
