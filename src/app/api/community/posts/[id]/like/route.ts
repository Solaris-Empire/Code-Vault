// POST   /api/community/posts/[id]/like   — like a post
// DELETE /api/community/posts/[id]/like   — unlike
//
// The counter on posts.like_count is kept in sync by a DB trigger,
// so we don't need to update it from app code.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const rl = await checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

  const admin = getSupabaseAdmin()

  // Self-like guard. Cheap to check, and we'd rather block this at the
  // edge than let the like_count trigger inflate an author's own number.
  const { data: post } = await admin
    .from('posts')
    .select('author_id')
    .eq('id', id)
    .maybeSingle()

  if (!post) {
    return NextResponse.json({ error: { message: 'Post not found' } }, { status: 404 })
  }
  if (post.author_id === auth.user!.id) {
    return NextResponse.json(
      { error: { message: 'You cannot like your own post.' } },
      { status: 400 },
    )
  }

  const { error } = await admin
    .from('post_likes')
    .upsert(
      { post_id: id, user_id: auth.user!.id },
      { onConflict: 'post_id,user_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[post-like] insert failed:', error)
    return NextResponse.json({ error: { message: 'Failed to like post' } }, { status: 500 })
  }

  return NextResponse.json({ data: { liked: true } })
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const rl = await checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('post_likes')
    .delete()
    .eq('post_id', id)
    .eq('user_id', auth.user!.id)

  if (error) {
    console.error('[post-like] delete failed:', error)
    return NextResponse.json({ error: { message: 'Failed to unlike post' } }, { status: 500 })
  }

  return NextResponse.json({ data: { liked: false } })
}
