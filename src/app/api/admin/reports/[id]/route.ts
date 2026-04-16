// PATCH /api/admin/reports/[id] — update report status.
//
// Admin-only via app-level check. RLS would also block non-admins
// at the DB layer — belt and braces.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  status: z.enum(['open', 'reviewing', 'actioned', 'dismissed']),
  note: z.string().trim().max(2000).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', auth.user!.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: { message: 'Admin only' } }, { status: 403 })
  }

  const { id } = await ctx.params

  let input: z.infer<typeof PatchSchema>
  try {
    input = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid update', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  const patch: Record<string, unknown> = { status: input.status }
  if (input.status === 'actioned' || input.status === 'dismissed') {
    patch.resolved_by = auth.user!.id
    patch.resolved_at = new Date().toISOString()
  }
  if (input.note !== undefined) patch.resolution_note = input.note

  const { error } = await admin.from('reports').update(patch).eq('id', id)
  if (error) {
    console.error('[admin-reports] update failed:', error)
    return NextResponse.json({ error: { message: 'Failed to update' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}
