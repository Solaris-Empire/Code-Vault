// PUT /api/community/map-pin
// Updates the current user's map pin: country, city, optional exact
// coordinates, and the two opt-in toggles. Auth required. Validates
// that the country code is one we know how to place.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'
import { COUNTRY_CENTROIDS } from '@/lib/community/country-centroids'

export const dynamic = 'force-dynamic'

const PinSchema = z.object({
  countryCode: z.string().length(2).toUpperCase().nullable(),
  city: z.string().trim().max(80).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  showOnMap: z.boolean(),
  shareExactLocation: z.boolean(),
  mapBio: z.string().trim().max(140).nullable(),
})

export async function PUT(request: NextRequest) {
  const rl = await checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof PinSchema>
  try {
    input = PinSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid pin data', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  // Map opt-in requires at least a country we can render.
  if (input.showOnMap && (!input.countryCode || !COUNTRY_CENTROIDS[input.countryCode])) {
    return NextResponse.json(
      { error: { message: 'Pick a supported country to appear on the map.' } },
      { status: 400 },
    )
  }

  // Exact location only persists if the user opted in to share it AND
  // we have real coordinates. Strip otherwise so stale values can't leak.
  const lat = input.shareExactLocation ? input.latitude : null
  const lng = input.shareExactLocation ? input.longitude : null

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('users')
    .update({
      country_code: input.countryCode,
      city: input.city,
      latitude: lat,
      longitude: lng,
      show_on_map: input.showOnMap,
      share_exact_location: input.shareExactLocation,
      map_bio: input.mapBio,
    })
    .eq('id', auth.user!.id)

  if (error) {
    console.error('[map-pin] update failed:', error)
    return NextResponse.json({ error: { message: 'Failed to save your pin' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}
