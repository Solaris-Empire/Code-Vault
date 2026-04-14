'use client'

// Leaflet rendering primitive. Loaded only client-side via next/dynamic
// in map-view-client.tsx — never imported from a server component.
//
// Marker color is derived from the pin's role + rank. We use Leaflet's
// divIcon (HTML markers) so we can style with Tailwind/inline CSS rather
// than ship a sprite sheet.

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import type { MapPin } from './map-view-client'

interface PinWithPos extends MapPin {
  _pos: [number, number]
}

interface Props {
  pins: PinWithPos[]
}

// Build the HTML used inside each div-icon marker.
function buildIcon(role: string): L.DivIcon {
  const color =
    role === 'seller' || role === 'admin'
      ? '#1B6B3A'
      : role === 'buyer'
        ? '#E8861A'
        : '#6B7280'

  return L.divIcon({
    className: '',
    html: `<div style="
      width: 20px;
      height: 20px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  })
}

// When the pin set changes, gently re-fit bounds so all pins stay
// visible. Skip on empty so we keep the default world view.
function FitBounds({ pins }: { pins: PinWithPos[] }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length === 0) return
    const bounds = L.latLngBounds(pins.map((p) => p._pos))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 })
  }, [pins, map])
  return null
}

export default function LeafletMap({ pins }: Props) {
  return (
    <div className="h-[600px] w-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        scrollWheelZoom
        worldCopyJump
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={pins} />
        {pins.map((p) => (
          <Marker key={p.id} position={p._pos} icon={buildIcon(p.role)}>
            <Popup>
              <div className="min-w-[180px]">
                <p className="font-semibold text-sm m-0">
                  {p.display_name || 'Anonymous'}
                </p>
                <p className="text-xs text-gray-600 m-0 mt-0.5">
                  {p.city ? `${p.city}, ` : ''}
                  {p.country_code}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 m-0 mt-1">
                  {p.role === 'seller' || p.role === 'admin'
                    ? 'Dev / Seller'
                    : 'Buyer'}
                  {p.seller_rank_key && ` · ${p.seller_rank_key.replace(/_/g, ' ')}`}
                  {p.buyer_tier && ` · ${p.buyer_tier}`}
                </p>
                {p.map_bio && (
                  <p className="text-xs italic text-gray-700 m-0 mt-2">
                    "{p.map_bio}"
                  </p>
                )}
                <Link
                  href={`/sellers/${p.id}`}
                  className="block mt-2 text-xs font-semibold text-green-700 hover:underline"
                >
                  View profile →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
