// /community — the DevSocial feed home.
//
// Server component: fetches the first page of posts + trending
// hashtags + the viewer's identity, then hands the initial state
// off to FeedViewClient which owns pagination + compose + likes.

import { MessagesSquare, TrendingUp, Globe2 } from 'lucide-react'
import Link from 'next/link'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import type { FeedPost } from '@/lib/community/posts'
import FeedViewClient from './feed-view-client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Community · CodeVault' }

interface SearchParams {
  sort?: string
  hashtag?: string
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  requireBetaFeature('community_feed')
  const { sort: rawSort, hashtag: rawTag } = await searchParams
  const sort: 'new' | 'trending' = rawSort === 'trending' ? 'trending' : 'new'
  const hashtag = rawTag ? rawTag.toLowerCase().replace(/^#/, '') : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = getSupabaseAdmin()

  const [{ data: postsRaw }, { data: trendingRaw }, viewerProfileRes] = await Promise.all([
    admin.rpc('get_feed', {
      p_viewer_id: user?.id ?? null,
      p_sort: sort,
      p_hashtag: hashtag,
      p_limit: 20,
      p_before: null,
    }),
    admin.rpc('get_trending_hashtags', { p_hours: 72, p_limit: 8 }),
    user
      ? admin
          .from('users')
          .select('display_name, avatar_url, role, seller_rank_key, buyer_tier')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const initialPosts: FeedPost[] = (postsRaw ?? []) as FeedPost[]
  const trending: { tag: string; post_count: number }[] =
    (trendingRaw ?? []) as { tag: string; post_count: number }[]
  const viewerProfile = viewerProfileRes.data

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <header className="border-b border-(--color-border) bg-(--color-surface)">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted) uppercase tracking-[0.18em] mb-2">
            <MessagesSquare className="h-3.5 w-3.5" />
            DevSocial
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            What's the community building?
          </h1>
          <p className="text-(--color-text-secondary) mt-2 max-w-2xl">
            Ship updates, drop code snippets, trade opinions. Tech people
            only — powered by your rank and what you've been building.
          </p>
          <div className="flex items-center gap-3 mt-4 text-sm">
            <Link
              href="/community"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                sort === 'new' && !hashtag
                  ? 'bg-(--brand-primary) text-white'
                  : 'bg-(--color-elevated) text-(--color-text-secondary) hover:bg-(--color-border)'
              }`}
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              Latest
            </Link>
            <Link
              href="/community?sort=trending"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                sort === 'trending' && !hashtag
                  ? 'bg-(--brand-primary) text-white'
                  : 'bg-(--color-elevated) text-(--color-text-secondary) hover:bg-(--color-border)'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Trending
            </Link>
            <Link
              href="/community/map"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-(--color-elevated) text-(--color-text-secondary) hover:bg-(--color-border)"
            >
              <Globe2 className="h-3.5 w-3.5" />
              World Map
            </Link>
          </div>
          {hashtag && (
            <div className="mt-4 inline-flex items-center gap-2 bg-(--brand-primary)/10 text-(--brand-primary) px-3 py-1.5 text-sm font-semibold">
              <span>#{hashtag}</span>
              <Link href="/community" className="text-xs opacity-70 hover:opacity-100">
                clear ×
              </Link>
            </div>
          )}
        </div>
      </header>

      <FeedViewClient
        initialPosts={initialPosts}
        trending={trending}
        sort={sort}
        hashtag={hashtag}
        viewer={
          user && viewerProfile
            ? {
                id: user.id,
                displayName: viewerProfile.display_name,
                avatarUrl: viewerProfile.avatar_url,
                role: viewerProfile.role,
                rankKey: viewerProfile.seller_rank_key,
                buyerTier: viewerProfile.buyer_tier,
              }
            : null
        }
      />
    </div>
  )
}
