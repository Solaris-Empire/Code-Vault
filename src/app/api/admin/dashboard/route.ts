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
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
}

async function isAdmin() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const thisMonth = now.toISOString().slice(0, 7)

  try {
    const [
      usersCount,
      productsCount,
      pendingProducts,
      ordersData,
      reviewsCount,
      recentProducts,
      recentOrders,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('id, amount_cents, platform_fee_cents, status, created_at').eq('status', 'completed'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('id, title, slug, status, created_at, seller:users(display_name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('orders').select('id, amount_cents, platform_fee_cents, status, created_at, buyer:users!orders_buyer_id_fkey(display_name), product:products(title)').order('created_at', { ascending: false }).limit(10),
    ])

    const orders = ordersData.data || []
    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_cents || 0), 0)
    const platformRevenue = orders.reduce((sum, o) => sum + (o.platform_fee_cents || 0), 0)
    const thisMonthOrders = orders.filter(o => o.created_at?.startsWith(thisMonth))
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0)

    return NextResponse.json({
      data: {
        overview: {
          totalUsers: usersCount.count || 0,
          totalProducts: productsCount.count || 0,
          pendingProducts: pendingProducts.count || 0,
          totalOrders: orders.length,
          totalRevenue,
          platformRevenue,
          thisMonthRevenue,
          totalReviews: reviewsCount.count || 0,
        },
        recentProducts: recentProducts.data || [],
        recentOrders: recentOrders.data || [],
      },
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: { message: 'Failed to fetch dashboard stats' } }, { status: 500 })
  }
}
