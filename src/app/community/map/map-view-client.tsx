'use client'

// Client-only Leaflet wrapper. We import Leaflet styles + library
// dynamically to keep them out of the server bundle (Leaflet touches
// `window` and breaks SSR).

import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin as MapPinIcon, Edit3, Eye, EyeOff, X, Loader2, LocateFixed } from 'lucide-react'
import { COUNTRY_OPTIONS, resolvePinPosition } from '@/lib/community/country-centroids'
import 'leaflet/dist/leaflet.css'

export interface MapPin {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: string
  country_code: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  seller_rank_key: string | null
  buyer_tier: string | null
  map_bio: string | null
}

export interface ViewerPin {
  countryCode: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  showOnMap: boolean
  shareExactLocation: boolean
  mapBio: string | null
}

interface Props {
  pins: MapPin[]
  viewerPin: ViewerPin | null
  viewerId: string | null
  viewerLoggedIn: boolean
}

// Leaflet must be loaded only in the browser. next/dynamic with
// ssr:false ensures the bundle never runs server-side.
const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center bg-(--color-elevated) text-(--color-text-muted)">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
})

type RoleFilter = 'all' | 'seller' | 'buyer'

export default function MapViewClient({ pins, viewerPin, viewerId, viewerLoggedIn }: Props) {
  const [filter, setFilter] = useState<RoleFilter>('all')
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  const filteredPins = useMemo(() => {
    return pins
      .filter((p) => {
        if (filter === 'all') return true
        if (filter === 'seller') return p.role === 'seller' || p.role === 'admin'
        if (filter === 'buyer') return p.role === 'buyer'
        return true
      })
      .map((p) => {
        const pos = resolvePinPosition({
          countryCode: p.country_code,
          latitude: p.latitude,
          longitude: p.longitude,
        })
        return pos ? { ...p, _pos: pos } : null
      })
      .filter((p): p is MapPin & { _pos: [number, number] } => p !== null)
  }, [pins, filter])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Map */}
      <div className="border border-(--color-border) bg-(--color-surface) overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            {(['all', 'seller', 'buyer'] as RoleFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  filter === f
                    ? 'bg-(--brand-primary) text-white'
                    : 'bg-(--color-elevated) text-(--color-text-secondary) hover:bg-(--color-border)'
                }`}
              >
                {f === 'all' ? 'Everyone' : f === 'seller' ? 'Devs · Sellers' : 'Buyers'}
              </button>
            ))}
          </div>
          <span className="text-xs text-(--color-text-muted)">
            {filteredPins.length} pins
          </span>
        </div>
        <LeafletMap pins={filteredPins} />
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        {viewerLoggedIn && viewerPin ? (
          <div className="border border-(--color-border) bg-(--color-surface) p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-(--color-text-secondary)">
                Your pin
              </h3>
              {viewerPin.showOnMap ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-(--brand-primary) font-semibold">
                  <Eye className="h-3 w-3" /> Visible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-(--color-text-muted)">
                  <EyeOff className="h-3 w-3" /> Hidden
                </span>
              )}
            </div>
            {viewerPin.countryCode ? (
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  {viewerPin.city || COUNTRY_OPTIONS.find((c) => c.code === viewerPin.countryCode)?.name}
                </p>
                <p className="text-xs text-(--color-text-muted) mt-0.5">
                  {COUNTRY_OPTIONS.find((c) => c.code === viewerPin.countryCode)?.name}
                  {viewerPin.shareExactLocation && ' · exact'}
                </p>
                {viewerPin.mapBio && (
                  <p className="text-xs text-(--color-text-secondary) mt-2 italic">
                    "{viewerPin.mapBio}"
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-(--color-text-secondary)">
                You haven't placed a pin yet.
              </p>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold py-2 hover:opacity-90 transition-opacity"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {viewerPin.countryCode ? 'Edit pin' : 'Place me on the map'}
            </button>
          </div>
        ) : !viewerLoggedIn ? (
          <div className="border border-(--color-border) bg-(--color-surface) p-4">
            <h3 className="font-semibold text-sm">Want a pin?</h3>
            <p className="text-sm text-(--color-text-secondary) mt-1">
              Sign in to add yourself to the map.
            </p>
            <Link
              href="/login?redirectTo=/community/map"
              className="mt-3 block text-center bg-(--brand-primary) text-white text-sm font-semibold py-2 hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        ) : null}

        <div className="border border-(--color-border) bg-(--color-surface) p-4 text-xs text-(--color-text-secondary) leading-relaxed">
          <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <MapPinIcon className="h-3.5 w-3.5" /> Privacy
          </p>
          <p>
            Pins are <span className="font-semibold text-foreground">opt-in</span>.
            We show country + city only by default. Exact GPS coordinates are
            never shared unless you flip the second toggle.
          </p>
        </div>
      </aside>

      {editOpen && viewerLoggedIn && (
        <EditPinModal
          initial={viewerPin}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            router.refresh()
          }}
          viewerId={viewerId}
        />
      )}
    </div>
  )
}

// ─── Edit modal ────────────────────────────────────────────────────

function EditPinModal({
  initial,
  onClose,
  onSaved,
  viewerId,
}: {
  initial: ViewerPin | null
  onClose: () => void
  onSaved: () => void
  viewerId: string | null
}) {
  const [countryCode, setCountryCode] = useState(initial?.countryCode ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null)
  const [showOnMap, setShowOnMap] = useState(initial?.showOnMap ?? true)
  const [shareExact, setShareExact] = useState(initial?.shareExactLocation ?? false)
  const [mapBio, setMapBio] = useState(initial?.mapBio ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  void viewerId

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Your browser does not support geolocation.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)))
        setLongitude(Number(pos.coords.longitude.toFixed(6)))
        setLocating(false)
      },
      () => {
        setError('Could not get your location. Pick a country manually below.')
        setLocating(false)
      },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/community/map-pin', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          countryCode: countryCode || null,
          city: city.trim() || null,
          latitude,
          longitude,
          showOnMap,
          shareExactLocation: shareExact,
          mapBio: mapBio.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Failed to save')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Network error. Try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-(--color-surface) border border-(--color-border) max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
          <h3 className="font-semibold">Edit your pin</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center hover:bg-(--color-elevated)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
              Country
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            >
              <option value="">Select a country…</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
              City (optional)
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              placeholder="Toronto"
              className="w-full bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
              Bio for your pin (optional)
            </label>
            <input
              type="text"
              value={mapBio}
              onChange={(e) => setMapBio(e.target.value)}
              maxLength={140}
              placeholder="Building React + Supabase apps"
              className="w-full bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            />
            <p className="text-[11px] text-(--color-text-muted) mt-1">{mapBio.length}/140</p>
          </div>

          <div className="border border-(--color-border) p-3 space-y-3 bg-(--color-elevated)/40">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnMap}
                onChange={(e) => setShowOnMap(e.target.checked)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <p className="font-semibold">Show me on the map</p>
                <p className="text-xs text-(--color-text-secondary) mt-0.5">
                  Off by default. Anyone visiting the map will see your pin.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shareExact}
                onChange={(e) => setShareExact(e.target.checked)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <p className="font-semibold">Share exact location</p>
                <p className="text-xs text-(--color-text-secondary) mt-0.5">
                  Off → pin shows at your country's center. On → pin shows your
                  GPS coordinates.
                </p>
              </div>
            </label>

            {shareExact && (
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="w-full inline-flex items-center justify-center gap-1.5 border border-(--color-border) bg-(--color-surface) text-sm py-2 hover:bg-(--color-elevated) disabled:opacity-50"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5" />
                )}
                Use my current location
              </button>
            )}

            {shareExact && latitude !== null && longitude !== null && (
              <p className="text-[11px] text-(--color-text-muted) text-center">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            )}
          </div>

          {error && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-600 text-sm p-3">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-(--color-border)">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm hover:bg-(--color-elevated)"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-(--brand-primary) text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save pin
          </button>
        </div>
      </div>
    </div>
  )
}
