// Server wrapper — loads seller tier + categories so the form can gate
// the Real Coder option and render the category dropdown.

import { redirect } from 'next/navigation'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import type { SellerTier } from '@/lib/seller/tier'
import NewServiceForm from './new-service-form'

export const dynamic = 'force-dynamic'

export default async function NewServicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/seller/services/new')

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('users')
    .select('role, seller_tier')
    .eq('id', user.id)
    .single()

  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    redirect('/register?role=seller')
  }

  const { data: categories } = await admin
    .from('categories')
    .select('id, name, icon')
    .order('sort_order', { ascending: true })

  const tier = (profile.seller_tier ?? 'unverified') as SellerTier

  return (
    <NewServiceForm
      sellerTier={tier}
      categories={(categories || []) as Array<{ id: string; name: string; icon: string | null }>}
    />
  )
}
