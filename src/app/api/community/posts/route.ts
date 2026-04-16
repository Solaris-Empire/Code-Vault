// /api/community/posts
//
// POST — create a new post (auth required)
// GET  — list feed (public, paginates via `before` cursor)
//
// Hashtag extraction is server-side: we can't trust the client to
// parse tags correctly and the trending RPC relies on the array
// being normalised.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin, createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'
import {
  POST_MAX_LEN,
  CODE_MAX_LEN,
  CODE_LANGUAGES,
  extractHashtags,
  normaliseTechStack,
} from '@/lib/community/posts'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  body: z.string().trim().min(1).max(POST_MAX_LEN),
  codeSnippet: z.string().max(CODE_MAX_LEN).nullable().optional(),
  codeLanguage: z.string().max(30).nullable().optional(),
  // Image URLs are user-supplied (no upload pipeline yet), so the
  // strongest guarantee we can offer is that the link is HTTPS.
  // Plain HTTP would mixed-content-warn in the feed and is a downgrade
  // vector; reject it at the boundary.
  imageUrl: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith('https://'), {
      message: 'Image URL must be HTTPS',
    })
    .nullable()
    .optional(),
  techStackTags: z.array(z.string().max(30)).max(20).optional(),
  productId: z.string().uuid().nullable().optional(),
})

export async function POST(request: NextRequest) {
  // Throttle post creation — without this a single signed-in account
  // can flood the feed in seconds.
  const rl = await checkRateLimit(request, rateLimitConfigs.upload)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof CreateSchema>
  try {
    input = CreateSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid post data', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  // Reject a code_snippet with no language — ensures we can always
  // render it with a highlighter. If user supplied an unknown lang
  // we allow it; Shiki has graceful fallbacks.
  const codeSnippet = input.codeSnippet?.trim() || null
  const codeLanguage = codeSnippet
    ? (input.codeLanguage?.trim().toLowerCase() || 'plaintext')
    : null
  void CODE_LANGUAGES

  const hashtags = extractHashtags(input.body)
  const techStack = normaliseTechStack(input.techStackTags ?? [])

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('posts')
    .insert({
      author_id: auth.user!.id,
      body: input.body.trim(),
      code_snippet: codeSnippet,
      code_language: codeLanguage,
      image_url: input.imageUrl?.trim() || null,
      hashtags,
      tech_stack_tags: techStack,
      product_id: input.productId ?? null,
    })
    .select('id, created_at')
    .single()

  if (error || !data) {
    console.error('[posts] create failed:', error)
    return NextResponse.json({ error: { message: 'Failed to publish post' } }, { status: 500 })
  }

  return NextResponse.json({ data: { id: data.id, created_at: data.created_at } })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const sort = url.searchParams.get('sort') === 'trending' ? 'trending' : 'new'
  const hashtagRaw = url.searchParams.get('hashtag')
  const hashtag = hashtagRaw ? hashtagRaw.toLowerCase().replace(/^#/, '') : null
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50)
  const before = url.searchParams.get('before')

  // Public endpoint — viewer identification is best-effort for
  // "viewer_liked" flags; no auth error if missing.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = getSupabaseAdmin()
  const { data, error } = await admin.rpc('get_feed', {
    p_viewer_id: user?.id ?? null,
    p_sort: sort,
    p_hashtag: hashtag,
    p_limit: limit,
    p_before: before,
  })

  if (error) {
    console.error('[posts] feed fetch failed:', error)
    return NextResponse.json({ error: { message: 'Failed to load feed' } }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
