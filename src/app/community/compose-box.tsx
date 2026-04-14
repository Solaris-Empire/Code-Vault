'use client'

// Compose box — text body, optional code snippet toggle,
// tech-stack chips, optional image URL. Keeps scope tight:
// uploads come in a later sprint.

import { useState } from 'react'
import Link from 'next/link'
import { Code2, Hash, Image as ImageIcon, Loader2, X } from 'lucide-react'
import {
  POST_MAX_LEN,
  CODE_MAX_LEN,
  CODE_LANGUAGES,
  TECH_STACK_OPTIONS,
  normaliseTechStack,
  type FeedPost,
  type BuyerTier,
} from '@/lib/community/posts'
import type { SellerRankKey } from '@/components/seller/seller-rank-badge'

interface Viewer {
  id: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  rankKey: SellerRankKey | null
  buyerTier: BuyerTier | null
}

interface Props {
  viewer: Viewer
  onPosted: (post: FeedPost) => void
}

export default function ComposeBox({ viewer, onPosted }: Props) {
  const [body, setBody] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [codeSnippet, setCodeSnippet] = useState('')
  const [codeLanguage, setCodeLanguage] = useState<string>('typescript')
  const [showImage, setShowImage] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [showTags, setShowTags] = useState(false)
  const [techStack, setTechStack] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooLong = body.length > POST_MAX_LEN
  const codeTooLong = codeSnippet.length > CODE_MAX_LEN
  const canSubmit =
    body.trim().length > 0 &&
    !tooLong &&
    !codeTooLong &&
    !submitting

  function toggleTag(tag: string) {
    setTechStack((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : normaliseTechStack([...prev, tag]),
    )
  }

  async function submit() {
    setError(null)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          codeSnippet: showCode && codeSnippet.trim() ? codeSnippet : null,
          codeLanguage: showCode && codeSnippet.trim() ? codeLanguage : null,
          imageUrl: showImage && imageUrl.trim() ? imageUrl.trim() : null,
          techStackTags: showTags ? techStack : [],
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Failed to post')
        setSubmitting(false)
        return
      }

      // Synthesise the feed row locally so we can prepend without refetching.
      const newPost: FeedPost = {
        id: json.data.id,
        author_id: viewer.id,
        body: body.trim(),
        code_snippet: showCode && codeSnippet.trim() ? codeSnippet : null,
        code_language: showCode && codeSnippet.trim() ? codeLanguage : null,
        image_url: showImage && imageUrl.trim() ? imageUrl.trim() : null,
        hashtags: body.match(/#(\w{2,30})/g)?.map((m) => m.slice(1).toLowerCase()) ?? [],
        tech_stack_tags: showTags ? techStack : [],
        product_id: null,
        like_count: 0,
        comment_count: 0,
        created_at: json.data.created_at,
        author_name: viewer.displayName,
        author_avatar: viewer.avatarUrl,
        author_role: viewer.role,
        author_rank_key: viewer.rankKey,
        author_buyer_tier: viewer.buyerTier,
        viewer_liked: false,
      }
      onPosted(newPost)

      // Reset form.
      setBody('')
      setCodeSnippet('')
      setImageUrl('')
      setTechStack([])
      setShowCode(false)
      setShowImage(false)
      setShowTags(false)
      setSubmitting(false)
    } catch {
      setError('Network error. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-(--color-border) bg-(--color-surface)">
      <div className="p-4 flex gap-3">
        <Link href={`/sellers/${viewer.id}`} className="shrink-0">
          {viewer.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewer.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-(--color-elevated) flex items-center justify-center text-sm font-semibold text-(--color-text-muted)">
              {(viewer.displayName || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What are you building? (# to tag topics)"
            rows={3}
            className="w-full bg-transparent border-0 p-0 text-sm placeholder:text-(--color-text-muted) focus:outline-none resize-none"
          />

          {showCode && (
            <div className="mt-3 border border-(--color-border) bg-(--color-elevated)/40">
              <div className="flex items-center justify-between px-3 py-2 border-b border-(--color-border)">
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                >
                  {CODE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
                <button
                  onClick={() => { setShowCode(false); setCodeSnippet('') }}
                  className="text-(--color-text-muted) hover:text-foreground"
                  aria-label="Remove code"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                placeholder="// paste a snippet…"
                rows={6}
                className="w-full bg-transparent p-3 text-xs font-mono focus:outline-none resize-y"
              />
            </div>
          )}

          {showImage && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://image-url.png"
                className="flex-1 bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
              />
              <button
                onClick={() => { setShowImage(false); setImageUrl('') }}
                className="h-9 w-9 flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-elevated)"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {showTags && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-(--color-text-muted) mb-1.5">
                Tech stack
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TECH_STACK_OPTIONS.map((tag) => {
                  const selected = techStack.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                        selected
                          ? 'bg-(--brand-primary) text-white border-(--brand-primary)'
                          : 'bg-(--color-elevated) text-(--color-text-secondary) border-(--color-border) hover:border-(--brand-primary)'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 border border-red-500/40 bg-red-500/10 text-red-600 text-xs p-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t border-(--color-border)">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`h-8 w-8 flex items-center justify-center hover:bg-(--color-elevated) ${showCode ? 'text-(--brand-primary)' : 'text-(--color-text-muted)'}`}
            aria-label="Add code snippet"
            title="Code snippet"
          >
            <Code2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowImage((v) => !v)}
            className={`h-8 w-8 flex items-center justify-center hover:bg-(--color-elevated) ${showImage ? 'text-(--brand-primary)' : 'text-(--color-text-muted)'}`}
            aria-label="Add image URL"
            title="Image URL"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowTags((v) => !v)}
            className={`h-8 w-8 flex items-center justify-center hover:bg-(--color-elevated) ${showTags ? 'text-(--brand-primary)' : 'text-(--color-text-muted)'}`}
            aria-label="Tech stack tags"
            title="Tech stack"
          >
            <Hash className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] ${tooLong ? 'text-red-600' : 'text-(--color-text-muted)'}`}>
            {body.length}/{POST_MAX_LEN}
          </span>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold px-4 py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
