'use client'

// Client-side feed shell.
//
// Holds the in-memory post list so like/unlike can be applied
// optimistically without a full page reload. New posts from the
// compose box are prepended so the author sees them instantly.

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Hash } from 'lucide-react'
import type { FeedPost, BuyerTier } from '@/lib/community/posts'
import type { SellerRankKey } from '@/components/seller/seller-rank-badge'
import ComposeBox from './compose-box'
import PostCard from './post-card'

interface Viewer {
  id: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  rankKey: SellerRankKey | null
  buyerTier: BuyerTier | null
}

interface Props {
  initialPosts: FeedPost[]
  trending: { tag: string; post_count: number }[]
  sort: 'new' | 'trending'
  hashtag: string | null
  viewer: Viewer | null
}

export default function FeedViewClient({
  initialPosts,
  trending,
  sort,
  hashtag,
  viewer,
}: Props) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(initialPosts.length < 20)

  function handlePosted(newPost: FeedPost) {
    setPosts((prev) => [newPost, ...prev])
  }

  function handleLikeToggle(postId: string, liked: boolean) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              viewer_liked: liked,
              like_count: Math.max(0, p.like_count + (liked ? 1 : -1)),
            }
          : p,
      ),
    )
  }

  async function loadMore() {
    if (loadingMore || reachedEnd || posts.length === 0) return
    setLoadingMore(true)
    const cursor = posts[posts.length - 1].created_at
    const params = new URLSearchParams({
      sort,
      before: cursor,
      limit: '20',
    })
    if (hashtag) params.set('hashtag', hashtag)

    try {
      const res = await fetch(`/api/community/posts?${params.toString()}`)
      const json = await res.json()
      const next: FeedPost[] = json.data ?? []
      if (next.length === 0) {
        setReachedEnd(true)
      } else {
        setPosts((prev) => [...prev, ...next])
        if (next.length < 20) setReachedEnd(true)
      }
    } catch (err) {
      console.error('[feed] loadMore error:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4 min-w-0">
        {viewer ? (
          <ComposeBox viewer={viewer} onPosted={handlePosted} />
        ) : (
          <div className="border border-(--color-border) bg-(--color-surface) p-4 text-sm text-(--color-text-secondary) flex items-center justify-between gap-3">
            <span>
              Join the conversation. Sign in to post, like, and reply.
            </span>
            <Link
              href="/login?redirectTo=/community"
              className="shrink-0 bg-(--brand-primary) text-white text-xs font-semibold px-3 py-1.5"
            >
              Sign in
            </Link>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="border border-(--color-border) bg-(--color-surface) p-10 text-center text-sm text-(--color-text-muted)">
            Nothing here yet. Be the first to post.
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              viewerId={viewer?.id ?? null}
              onLikeToggle={handleLikeToggle}
            />
          ))
        )}

        {!reachedEnd && posts.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full border border-(--color-border) bg-(--color-surface) py-3 text-sm font-semibold text-(--color-text-secondary) hover:bg-(--color-elevated) disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      <aside className="space-y-4">
        <div className="border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-(--color-text-secondary) mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Trending
          </h3>
          {trending.length === 0 ? (
            <p className="text-xs text-(--color-text-muted)">
              Tags used in the last 72h will show up here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {trending.map((t) => (
                <li key={t.tag}>
                  <Link
                    href={`/community?hashtag=${encodeURIComponent(t.tag)}`}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm hover:bg-(--color-elevated) -mx-2"
                  >
                    <span className="inline-flex items-center gap-1 text-foreground font-medium">
                      <Hash className="h-3.5 w-3.5 text-(--brand-primary)" />
                      {t.tag}
                    </span>
                    <span className="text-xs text-(--color-text-muted)">
                      {t.post_count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-(--color-border) bg-(--color-surface) p-4 text-xs text-(--color-text-secondary) leading-relaxed">
          <p className="font-semibold text-foreground mb-1">Be useful.</p>
          <p>
            Post code, screenshots, wins, or questions. Be respectful. The
            report button exists — use it instead of escalating.
          </p>
        </div>
      </aside>
    </div>
  )
}
