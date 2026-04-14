// /community/map — world map of CodeVault devs/sellers/buyers.
//
// Server component fetches the public pin set (only opted-in users)
// via the get_map_pins RPC, then hands it off to the client map view.
// The current user's own pin settings come from a separate query so
// the sidebar can show their existing values in the edit panel.

import { redirect } from 'next/navigation'
import { Globe2, Users } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import MapViewClient, { type MapPin, type ViewerPin } from './map-view-client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'World Map · CodeVault' }

export default async function CommunityMapPage() {
  requireBetaFeature('community_map')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Logged-out users can browse the map; only the "edit my pin" panel is gated.

  const admin = getSupabaseAdmin()

  const [{ data: pinsRaw }, { data: viewerProfile }] = await Promise.all([
    admin.rpc('get_map_pins', { p_role: null }),
    user
      ? admin
          .from('users')
          .select('country_code, city, latitude, longitude, show_on_map, share_exact_location, map_bio')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const pins: MapPin[] = (pinsRaw ?? []) as MapPin[]
  const viewerPin: ViewerPin | null = viewerProfile
    ? {
        countryCode: viewerProfile.country_code,
        city: viewerProfile.city,
        latitude: viewerProfile.latitude !== null ? Number(viewerProfile.latitude) : null,
        longitude: viewerProfile.longitude !== null ? Number(viewerProfile.longitude) : null,
        showOnMap: viewerProfile.show_on_map,
        shareExactLocation: viewerProfile.share_exact_location,
        mapBio: viewerProfile.map_bio,
      }
    : null

  // Prevent middleware/redirect surprises in dev — this URL is intentionally public.
  if (false) redirect('/login')

  const totalPins = pins.length
  const sellerPins = pins.filter((p) => p.role === 'seller').length
  const buyerPins = pins.filter((p) => p.role === 'buyer').length

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <header className="border-b border-(--color-border) bg-(--color-surface)">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted) uppercase tracking-[0.18em] mb-2">
            <Globe2 className="h-3.5 w-3.5" />
            Community
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            CodeVault around the world
          </h1>
          <p className="text-(--color-text-secondary) mt-2 max-w-2xl">
            See where our developers and buyers are building from. Pin yourself
            on the map — it's opt-in, city-level by default.
          </p>
          <div className="flex items-center gap-5 mt-4 text-sm text-(--color-text-secondary)">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> <span className="font-semibold text-foreground">{totalPins}</span> pins
            </span>
            <span>·</span>
            <span><span className="font-semibold text-foreground">{sellerPins}</span> devs/sellers</span>
            <span>·</span>
            <span><span className="font-semibold text-foreground">{buyerPins}</span> buyers</span>
          </div>
        </div>
      </header>

      <MapViewClient
        pins={pins}
        viewerPin={viewerPin}
        viewerId={user?.id ?? null}
        viewerLoggedIn={Boolean(user)}
      />
    </div>
  )
}
