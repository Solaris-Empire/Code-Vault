'use client'

// Interactive chunk of the order detail page: brief panel, messaging thread,
// deliver/accept/revise/cancel actions.

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Loader2, Send, AlertCircle, CheckCircle2, RotateCcw, XCircle, Paperclip,
  User as UserIcon, FileText, ExternalLink, Star, Upload, Shield, X,
} from 'lucide-react'
import type {
  ServiceMessageRow, ServiceOrderStatus,
  ServiceReviewRow, ServiceDisputeRow,
} from '@/lib/services/types'

interface DeliveryAsset { url: string; name: string; sizeBytes?: number }

const DISPUTABLE: ServiceOrderStatus[] = ['in_progress', 'delivered', 'revision_requested']

interface Props {
  orderId: string
  status: ServiceOrderStatus
  viewerRole: 'buyer' | 'seller'
  viewerId: string
  brief: string
  deliveryNote: string | null
  deliveryAssets: unknown[]
  revisionsRemaining: number
  counterparty: { id: string; name: string; avatarUrl: string | null }
  initialMessages: ServiceMessageRow[]
  existingReview: ServiceReviewRow | null
  existingDispute: ServiceDisputeRow | null
}

export default function OrderDetailClient(props: Props) {
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [showDispute, setShowDispute] = useState(false)

  const canDispute =
    DISPUTABLE.includes(props.status) &&
    !props.existingDispute

  async function callAction(path: string, body: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setActionError(null)
    setBusyAction(path)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error?.message || 'Action failed')
        setBusyAction(null)
        return
      }
      router.refresh()
    } catch {
      setActionError('Network error — please try again.')
    } finally {
      setBusyAction(null)
    }
  }

  const deliveryAssets = Array.isArray(props.deliveryAssets)
    ? (props.deliveryAssets as DeliveryAsset[])
    : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: brief + delivery + messages */}
      <div className="lg:col-span-2 space-y-5">
        <section className="border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Brief
          </h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{props.brief}</p>
        </section>

        {props.deliveryNote && (
          <section className="border border-amber-200 bg-amber-50/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-amber-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Delivery
            </h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-(--color-text-primary) mb-3">
              {props.deliveryNote}
            </p>
            {deliveryAssets.length > 0 && (
              <div className="space-y-2">
                {deliveryAssets.map((a, i) => (
                  <a
                    key={`${a.url}-${i}`}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-white border border-amber-200 px-3 py-2 text-sm hover:bg-white"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-4 w-4 text-amber-700 shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Dispute banner */}
        {props.existingDispute && (
          <section className="border border-red-200 bg-red-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-2 text-red-800 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Dispute opened
            </h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-red-900 mb-2">
              {props.existingDispute.reason}
            </p>
            <p className="text-xs text-red-700">
              Status: <strong>{props.existingDispute.status.replace('_', ' ')}</strong> · opened{' '}
              {new Date(props.existingDispute.created_at).toLocaleDateString()}
            </p>
          </section>
        )}

        {/* Review form / existing review — buyer only, completed orders */}
        {props.viewerRole === 'buyer' && props.status === 'completed' && (
          props.existingReview ? (
            <ExistingReviewBlock review={props.existingReview} />
          ) : (
            <ReviewForm orderId={props.orderId} />
          )
        )}

        {/* Seller sees the review once buyer has left it */}
        {props.viewerRole === 'seller' && props.existingReview && (
          <ExistingReviewBlock review={props.existingReview} />
        )}

        {/* Thread */}
        <MessagingThread
          orderId={props.orderId}
          viewerId={props.viewerId}
          counterparty={props.counterparty}
          initial={props.initialMessages}
        />
      </div>

      {/* Right: actions */}
      <aside className="space-y-3">
        <div className="bg-white border border-gray-200 p-5 sticky top-20 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1">
            Actions
          </h3>

          {actionError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <ActionButtons
            status={props.status}
            viewerRole={props.viewerRole}
            orderId={props.orderId}
            revisionsRemaining={props.revisionsRemaining}
            busy={busyAction}
            onAction={callAction}
          />

          {canDispute && (
            <button
              type="button"
              onClick={() => setShowDispute(true)}
              className="w-full border border-red-200 text-red-700 hover:bg-red-50 py-2 px-3 text-sm font-medium inline-flex items-center justify-center gap-2 mt-2"
            >
              <Shield className="h-4 w-4" /> Open a dispute
            </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 p-5 text-xs text-(--color-text-secondary) leading-relaxed">
          <p className="font-semibold text-gray-900 text-sm mb-2">How escrow works</p>
          <p>
            Funds are held by CodeVault from the moment you pay. When the buyer accepts the delivery,
            they're released to the seller minus the platform fee. If you can't resolve an issue in
            messages, open a dispute and our team will review.
          </p>
          <Link href="/support" className="text-green-700 hover:underline mt-2 inline-block">
            Contact support →
          </Link>
        </div>
      </aside>

      {showDispute && (
        <DisputeModal orderId={props.orderId} onClose={() => setShowDispute(false)} />
      )}
    </div>
  )
}

function ActionButtons({
  status, viewerRole, orderId, revisionsRemaining, busy, onAction,
}: {
  status: ServiceOrderStatus
  viewerRole: 'buyer' | 'seller'
  orderId: string
  revisionsRemaining: number
  busy: string | null
  onAction: (path: string, body: unknown, confirm?: string) => void
}) {
  const [showDeliver, setShowDeliver] = useState(false)
  const [deliveryNote, setDeliveryNote] = useState('')
  const [uploadedAssets, setUploadedAssets] = useState<DeliveryAsset[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [showRevise, setShowRevise] = useState(false)
  const [reviseNote, setReviseNote] = useState('')

  async function handleDeliveryFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting same file
    if (files.length === 0) return
    setUploadError(null)
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bucket', 'service-deliveries')
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) {
          setUploadError(json.error?.message || `Upload failed for ${file.name}`)
          break
        }
        setUploadedAssets((prev) => [
          ...prev,
          { url: json.data?.url || json.url, name: file.name, sizeBytes: file.size },
        ])
      }
    } catch {
      setUploadError('Network error during upload. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function removeUploadedAsset(idx: number) {
    setUploadedAssets((prev) => prev.filter((_, i) => i !== idx))
  }

  if (status === 'completed' || status === 'cancelled' || status === 'refunded') {
    return <p className="text-sm text-(--color-text-muted)">This order is closed. No further actions.</p>
  }

  if (status === 'awaiting_payment') {
    return (
      <>
        <p className="text-sm text-(--color-text-muted)">
          Waiting on Stripe confirmation. You can cancel if you changed your mind.
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onAction(`/api/services/orders/${orderId}/cancel`, {}, 'Cancel this order?')}
          className="w-full border border-red-200 text-red-700 hover:bg-red-50 py-2 px-3 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy?.includes('cancel') ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Cancel order
        </button>
      </>
    )
  }

  // Seller: in_progress or revision_requested → can deliver
  if (viewerRole === 'seller' && (status === 'in_progress' || status === 'revision_requested')) {
    return (
      <>
        {showDeliver ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold">Delivery note</label>
            <textarea
              required
              minLength={10}
              maxLength={5_000}
              rows={4}
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Here's what I delivered…"
              className="w-full border border-gray-200 px-2.5 py-2 text-sm rounded-none focus:outline-none focus:border-green-400"
            />
            <label className="block text-xs font-semibold mt-2">Attach deliverables</label>
            <label
              className={`border border-dashed border-gray-300 p-3 text-center text-xs cursor-pointer block hover:border-green-400 hover:bg-green-50/30 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {uploading ? (
                <span className="inline-flex items-center gap-2 text-(--color-text-secondary)">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-(--color-text-secondary)">
                  <Upload className="h-3.5 w-3.5" /> Click to upload files (zip, pdf, images…)
                </span>
              )}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleDeliveryFilePick}
                disabled={uploading}
              />
            </label>
            {uploadError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {uploadError}
              </p>
            )}
            {uploadedAssets.length > 0 && (
              <ul className="space-y-1 pt-1">
                {uploadedAssets.map((a, i) => (
                  <li
                    key={`${a.url}-${i}`}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Paperclip className="h-3 w-3 text-(--color-text-muted) shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUploadedAsset(i)}
                      className="ml-2 text-red-600 hover:text-red-800 shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={
                  busy !== null ||
                  uploading ||
                  uploadedAssets.length === 0 ||
                  deliveryNote.trim().length < 10
                }
                onClick={() =>
                  onAction(`/api/services/orders/${orderId}/deliver`, {
                    note: deliveryNote.trim(),
                    assets: uploadedAssets,
                  })
                }
                className="flex-1 btn-primary text-white py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy?.includes('deliver') ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit delivery
              </button>
              <button
                type="button"
                onClick={() => setShowDeliver(false)}
                className="border border-gray-200 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeliver(true)}
            className="w-full btn-primary text-white py-2 px-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" /> Deliver work
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onAction(`/api/services/orders/${orderId}/cancel`, {}, 'Cancel this order? The buyer will be refunded.')}
          className="w-full border border-red-200 text-red-700 hover:bg-red-50 py-2 px-3 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" /> Cancel order
        </button>
      </>
    )
  }

  // Buyer: in_progress → can cancel; delivered → accept or revise
  if (viewerRole === 'buyer' && status === 'in_progress') {
    return (
      <>
        <p className="text-sm text-(--color-text-muted)">
          Seller is working on your order. Use messages to follow up.
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onAction(`/api/services/orders/${orderId}/cancel`, {}, 'Cancel this order? Funds will be refunded.')}
          className="w-full border border-red-200 text-red-700 hover:bg-red-50 py-2 px-3 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" /> Cancel order
        </button>
      </>
    )
  }

  if (viewerRole === 'buyer' && status === 'delivered') {
    return (
      <>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => onAction(`/api/services/orders/${orderId}/accept`, {}, 'Accept the delivery and release funds?')}
          className="w-full btn-primary text-white py-2 px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy?.includes('accept') ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Accept & release funds
        </button>

        {showRevise ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold">What needs to change?</label>
            <textarea
              minLength={10}
              maxLength={2_000}
              rows={4}
              value={reviseNote}
              onChange={(e) => setReviseNote(e.target.value)}
              className="w-full border border-gray-200 px-2.5 py-2 text-sm rounded-none focus:outline-none focus:border-green-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null || reviseNote.trim().length < 10}
                onClick={() => onAction(`/api/services/orders/${orderId}/revise`, { note: reviseNote.trim() })}
                className="flex-1 border border-orange-200 bg-orange-50 text-orange-800 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy?.includes('revise') ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Send revision request
              </button>
              <button
                type="button"
                onClick={() => setShowRevise(false)}
                className="border border-gray-200 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-(--color-text-muted)">{revisionsRemaining} revision(s) remaining.</p>
          </div>
        ) : (
          <button
            type="button"
            disabled={revisionsRemaining <= 0}
            onClick={() => setShowRevise(true)}
            className="w-full border border-orange-200 text-orange-800 hover:bg-orange-50 py-2 px-3 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {revisionsRemaining > 0 ? `Request revision (${revisionsRemaining} left)` : 'No revisions left'}
          </button>
        )}
      </>
    )
  }

  if (viewerRole === 'buyer' && status === 'revision_requested') {
    return (
      <p className="text-sm text-(--color-text-muted)">
        Waiting for the seller to send a revised delivery.
      </p>
    )
  }

  return null
}

function MessagingThread({
  orderId, viewerId, counterparty, initial,
}: {
  orderId: string
  viewerId: string
  counterparty: { id: string; name: string; avatarUrl: string | null }
  initial: ServiceMessageRow[]
}) {
  const [messages, setMessages] = useState<ServiceMessageRow[]>(initial)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setSending(true)
    setErr(null)
    try {
      const res = await fetch(`/api/services/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error?.message || 'Failed to send')
      } else {
        setMessages((m) => [...m, json.data as ServiceMessageRow])
        setDraft('')
      }
    } catch {
      setErr('Network error — please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="border border-gray-200 bg-white flex flex-col" style={{ minHeight: 360 }}>
      <header className="border-b border-gray-100 px-5 py-3 flex items-center gap-3">
        <div className="h-8 w-8 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
          {counterparty.avatarUrl ? (
            <Image src={counterparty.avatarUrl} alt="" width={32} height={32} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="h-4 w-4 text-(--color-text-muted)" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{counterparty.name}</p>
          <p className="text-[11px] text-(--color-text-muted)">Messages are kept for support reference.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 500 }}>
        {messages.length === 0 ? (
          <p className="text-sm text-(--color-text-muted) text-center py-8">
            No messages yet. Say hello and confirm the scope.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewerId
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 text-sm border ${
                    mine
                      ? 'bg-green-50 border-green-200 text-gray-900'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  <p className="text-[10px] text-(--color-text-muted) mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-gray-100 p-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={4_000}
          className="flex-1 border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-green-400"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="btn-primary text-white px-4 rounded-none text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </form>

      {err && (
        <div className="text-xs text-red-600 px-3 pb-2 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {err}
        </div>
      )}
    </section>
  )
}

function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) {
      setErr('Please choose a rating.')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch(`/api/services/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error?.message || 'Failed to submit review')
        setSubmitting(false)
        return
      }
      router.refresh()
    } catch {
      setErr('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <section className="border border-green-200 bg-green-50/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-green-800 flex items-center gap-2">
        <Star className="h-4 w-4" /> Leave a review
      </h2>
      <p className="text-xs text-(--color-text-secondary) mb-3">
        Reviews are public and help other buyers choose the right seller.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="p-0.5"
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
              >
                <Star
                  className={`h-6 w-6 ${active ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                />
              </button>
            )
          })}
          {rating > 0 && (
            <span className="ml-2 text-xs text-(--color-text-secondary)">{rating} / 5</span>
          )}
        </div>

        <textarea
          rows={4}
          maxLength={2_000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: share details about your experience…"
          className="w-full border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-green-400"
        />

        {err && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {err}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || rating < 1}
          className="btn-primary text-white py-2 px-4 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Submit review
        </button>
      </form>
    </section>
  )
}

function ExistingReviewBlock({ review }: { review: ServiceReviewRow }) {
  return (
    <section className="border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 text-(--color-text-secondary) flex items-center gap-2">
        <Star className="h-4 w-4" /> Buyer review
      </h2>
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-4 w-4 ${n <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-xs text-(--color-text-muted)">
          {new Date(review.created_at).toLocaleDateString()}
        </span>
      </div>
      {review.comment && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-900">{review.comment}</p>
      )}
    </section>
  )
}

function DisputeModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 20) {
      setErr('Please describe the issue in at least 20 characters.')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch(`/api/services/orders/${orderId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error?.message || 'Failed to open dispute')
        setSubmitting(false)
        return
      }
      onClose()
      router.refresh()
    } catch {
      setErr('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-800 flex items-center gap-2">
            <Shield className="h-4 w-4" /> Open a dispute
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-(--color-text-muted) hover:text-gray-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-(--color-text-secondary) leading-relaxed">
            Opening a dispute pauses the order and alerts our team. Use this when you and the other party
            can't resolve the issue in messages. Be specific — the more context you give, the faster we can help.
          </p>
          <label className="block text-xs font-semibold">What's the issue?</label>
          <textarea
            rows={6}
            minLength={20}
            maxLength={5_000}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what went wrong, what you expected, and what you've already tried…"
            className="w-full border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-red-400"
          />

          {err && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {err}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 20}
              className="border border-red-300 bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Open dispute
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
