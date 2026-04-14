'use client'

// Single post card: author, body (with #hashtags linkified), optional
// code snippet (plain <pre> — Shiki highlighting can land later),
// optional image, tech-stack chips, like/report actions.

import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, Flag, Code2 } from 'lucide-react'
import type { FeedPost } from '@/lib/community/posts'
import { relativeTime } from '@/lib/community/posts'
import { SellerRankBadge } from '@/components/seller/seller-rank-badge'
import { BuyerTierBadge } from '@/components/buyer/buyer-tier-badge'

interface Props {
  post: FeedPost
  viewerId: string | null
  onLikeToggle: (postId: string, liked: boolean) => void
}

// Turn #tags in the body into clickable links. Plain text stays plain.
function renderBody(body: string) {
  const parts = body.split(/(#\w{2,30})/g)
  return parts.map((part, i) => {
    if (/^#\w{2,30}$/.test(part)) {
      const tag = part.slice(1).toLowerCase()
      return (
        <Link
          key={i}
          href={`/community?hashtag=${encodeURIComponent(tag)}`}
          className="text-(--brand-primary) hover:underline"
        >
          {part}
        </Link>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function PostCard({ post, viewerId, onLikeToggle }: Props) {
  const [likeBusy, setLikeBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  async function toggleLike() {
    if (!viewerId || likeBusy) return
    const nextLiked = !post.viewer_liked
    setLikeBusy(true)
    // Optimistic update — parent tracks counts.
    onLikeToggle(post.id, nextLiked)
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, {
        method: nextLiked ? 'POST' : 'DELETE',
      })
      if (!res.ok) {
        // Roll back on failure.
        onLikeToggle(post.id, !nextLiked)
      }
    } catch {
      onLikeToggle(post.id, !nextLiked)
    } finally {
      setLikeBusy(false)
    }
  }

  const isSeller = post.author_role === 'seller' || post.author_role === 'admin'

  return (
    <article className="border border-(--color-border) bg-(--color-surface) p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/sellers/${post.author_id}`} className="shrink-0">
          {post.author_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author_avatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-(--color-elevated) flex items-center justify-center text-sm font-semibold text-(--color-text-muted)">
              {(post.author_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/sellers/${post.author_id}`}
              className="font-semibold text-sm text-foreground hover:underline truncate"
            >
              {post.author_name || 'Anonymous'}
            </Link>
            {isSeller && post.author_rank_key && (
              <SellerRankBadge rankKey={post.author_rank_key} size="inline" />
            )}
            {!isSeller && post.author_buyer_tier && (
              <BuyerTierBadge tier={post.author_buyer_tier} size="inline" />
            )}
            <span className="text-xs text-(--color-text-muted)">
              · {relativeTime(post.created_at)}
            </span>
          </div>

          {/* Body */}
          <p className="mt-1 text-sm whitespace-pre-wrap break-words text-foreground">
            {renderBody(post.body)}
          </p>

          {/* Tech stack chips */}
          {post.tech_stack_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.tech_stack_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider bg-(--color-elevated) text-(--color-text-secondary) px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Code snippet */}
          {post.code_snippet && (
            <div className="mt-3 border border-(--color-border) bg-(--color-elevated)/60 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-(--color-border) text-[10px] uppercase tracking-wider text-(--color-text-muted)">
                <Code2 className="h-3 w-3" />
                {post.code_language || 'code'}
              </div>
              <pre className="p-3 text-xs font-mono overflow-x-auto whitespace-pre text-foreground">
                {post.code_snippet}
              </pre>
            </div>
          )}

          {/* Image */}
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              className="mt-3 max-h-96 w-full object-contain bg-(--color-elevated) border border-(--color-border)"
            />
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-4 text-xs text-(--color-text-secondary)">
            <button
              onClick={toggleLike}
              disabled={!viewerId || likeBusy}
              className={`inline-flex items-center gap-1.5 transition-colors ${
                post.viewer_liked ? 'text-red-600' : 'hover:text-foreground'
              } disabled:opacity-60`}
              aria-label="Like post"
            >
              <Heart
                className={`h-4 w-4 ${post.viewer_liked ? 'fill-current' : ''}`}
              />
              {post.like_count}
            </button>
            <span className="inline-flex items-center gap-1.5 text-(--color-text-muted)">
              <MessageCircle className="h-4 w-4" />
              {post.comment_count}
            </span>
            {viewerId && viewerId !== post.author_id && (
              <button
                onClick={() => setReportOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 hover:text-foreground"
                aria-label="Report post"
              >
                <Flag className="h-3.5 w-3.5" />
                Report
              </button>
            )}
          </div>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          postId={post.id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </article>
  )
}

function ReportModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [reason, setReason] = useState<'spam' | 'harassment' | 'nsfw' | 'misinformation' | 'off_topic' | 'other'>('spam')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason, notes: notes.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Failed to report')
        setSubmitting(false)
        return
      }
      setSubmitted(true)
      setSubmitting(false)
    } catch {
      setError('Network error. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-(--color-surface) border border-(--color-border)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-(--color-border) font-semibold">
          Report this post
        </div>
        <div className="p-5 space-y-3">
          {submitted ? (
            <p className="text-sm text-(--color-text-secondary)">
              Thanks. A moderator will take a look.
            </p>
          ) : (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className="w-full bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
              >
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="nsfw">NSFW / explicit</option>
                <option value="misinformation">Misinformation</option>
                <option value="off_topic">Off-topic</option>
                <option value="other">Other</option>
              </select>
              <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mt-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Anything a moderator should know?"
                className="w-full bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
              />
              {error && (
                <div className="border border-red-500/40 bg-red-500/10 text-red-600 text-sm p-2">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-(--color-border)">
          <button onClick={onClose} className="px-4 py-2 text-sm hover:bg-(--color-elevated)">
            {submitted ? 'Close' : 'Cancel'}
          </button>
          {!submitted && (
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold bg-(--brand-primary) text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
