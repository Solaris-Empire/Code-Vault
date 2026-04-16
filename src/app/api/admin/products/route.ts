import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'all']).nullish(),
  search: z.string().trim().max(200).nullish(),
})

// ─── GET /api/admin/products ───────────────────────────────────────
// Lists all products for admin review. Supports filtering by status.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.error!

  const parsed = querySchema.safeParse({
    status: request.nextUrl.searchParams.get('status'),
    search: request.nextUrl.searchParams.get('search'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid query', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { status, search } = parsed.data

  const admin = getSupabaseAdmin()

  let query = admin
    .from('products')
    .select(`
      id, title, slug, status, price_cents, download_count,
      thumbnail_url, created_at,
      seller:users!products_seller_id_fkey(display_name),
      category:categories!products_category_id_fkey(name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (search) {
    // Escape PostgreSQL LIKE wildcards so a crafted search term can't
    // scan the whole table with `%%%%` or pin a regex-style pattern.
    const sanitized = search.replace(/[%_\\]/g, '\\$&')
    query = query.ilike('title', `%${sanitized}%`)
  }

  const { data: products, error } = await query

  if (error) {
    return NextResponse.json(
      { error: { message: 'Failed to fetch products' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: products || [] })
}
