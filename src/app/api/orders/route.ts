import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// GET - List buyer's orders
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, product:products(title, slug, thumbnail_url), license:licenses(license_key, license_type)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: { message: 'Failed to fetch orders' } }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch {
    return NextResponse.json({ error: { message: 'Failed to fetch orders' } }, { status: 500 })
  }
}
