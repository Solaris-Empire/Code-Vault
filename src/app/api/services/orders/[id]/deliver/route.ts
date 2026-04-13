// POST /api/services/orders/:id/deliver
// Seller submits deliverables. Flips status in_progress | revision_requested → delivered.
// Body: { note: string, assets: [{url,name,sizeBytes?}] }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { DeliveryPayloadSchema } from '@/lib/services/validation'

export const dynamic = 'force-dynamic'

// Every delivery URL must live inside our own service-deliveries storage
// bucket. The upload endpoint (/api/upload?bucket=service-deliveries)
// already validates extensions, MIME, magic bytes, and size — routing
// deliveries through it gives us one trusted chokepoint. External URLs
// (Dropbox, WeTransfer, random CDNs) are rejected because we can't
// enforce content guarantees on them and a seller could swap the file
// after delivery.
function getAllowedDeliveryPrefix(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured')
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/service-deliveries/`
}

function assertSafeDeliveryAssets(
  assets: z.infer<typeof DeliveryPayloadSchema>['assets'],
): string | null {
  const prefix = getAllowedDeliveryPrefix()
  for (const a of assets) {
    if (!a.url.toLowerCase().startsWith(prefix.toLowerCase())) {
      return `Asset "${a.name}" must be uploaded through CodeVault. External links are not allowed.`
    }
  }
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof DeliveryPayloadSchema>
  try {
    input = DeliveryPayloadSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid delivery', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  const assetError = assertSafeDeliveryAssets(input.assets)
  if (assetError) {
    return NextResponse.json({ error: { message: assetError } }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('service_orders')
    .select('id, seller_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  if (order.seller_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the seller can deliver' } }, { status: 403 })
  }
  if (!['in_progress', 'revision_requested'].includes(order.status)) {
    return NextResponse.json(
      { error: { message: `Cannot deliver from status "${order.status}"` } },
      { status: 400 },
    )
  }

  const { error: updateErr } = await admin
    .from('service_orders')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivery_note: input.note,
      delivery_assets: input.assets,
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: { message: 'Failed to mark delivered' } }, { status: 500 })
  }

  // Drop a system message on the thread.
  await admin.from('service_messages').insert({
    order_id: id,
    sender_id: auth.user!.id,
    body: `Delivered: ${input.note}`,
    attachments: input.assets,
  })

  return NextResponse.json({ data: { ok: true } })
}
