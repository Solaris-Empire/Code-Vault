// Country centroids (ISO 3166-1 alpha-2 → [lat, lng]).
//
// Used to place a map pin for users who opted in to show_on_map but
// did NOT opt in to share_exact_location. We render at the country's
// centroid instead of the user's actual coordinates.
//
// Data is public-domain rounded centroids — accurate enough for a
// "marker on a country" use case, not for navigation.

export const COUNTRY_CENTROIDS: Record<string, { name: string; lat: number; lng: number }> = {
  US: { name: 'United States', lat: 39.83, lng: -98.58 },
  CA: { name: 'Canada', lat: 56.13, lng: -106.35 },
  MX: { name: 'Mexico', lat: 23.63, lng: -102.55 },
  BR: { name: 'Brazil', lat: -14.24, lng: -51.93 },
  AR: { name: 'Argentina', lat: -38.42, lng: -63.62 },
  GB: { name: 'United Kingdom', lat: 55.38, lng: -3.44 },
  IE: { name: 'Ireland', lat: 53.41, lng: -8.24 },
  FR: { name: 'France', lat: 46.23, lng: 2.21 },
  DE: { name: 'Germany', lat: 51.17, lng: 10.45 },
  ES: { name: 'Spain', lat: 40.46, lng: -3.75 },
  IT: { name: 'Italy', lat: 41.87, lng: 12.57 },
  NL: { name: 'Netherlands', lat: 52.13, lng: 5.29 },
  BE: { name: 'Belgium', lat: 50.50, lng: 4.47 },
  CH: { name: 'Switzerland', lat: 46.82, lng: 8.23 },
  AT: { name: 'Austria', lat: 47.52, lng: 14.55 },
  SE: { name: 'Sweden', lat: 60.13, lng: 18.64 },
  NO: { name: 'Norway', lat: 60.47, lng: 8.47 },
  FI: { name: 'Finland', lat: 61.92, lng: 25.75 },
  DK: { name: 'Denmark', lat: 56.26, lng: 9.50 },
  PL: { name: 'Poland', lat: 51.92, lng: 19.15 },
  CZ: { name: 'Czechia', lat: 49.82, lng: 15.47 },
  HU: { name: 'Hungary', lat: 47.16, lng: 19.50 },
  RO: { name: 'Romania', lat: 45.94, lng: 24.97 },
  GR: { name: 'Greece', lat: 39.07, lng: 21.82 },
  PT: { name: 'Portugal', lat: 39.40, lng: -8.22 },
  RU: { name: 'Russia', lat: 61.52, lng: 105.32 },
  UA: { name: 'Ukraine', lat: 48.38, lng: 31.17 },
  TR: { name: 'Turkey', lat: 38.96, lng: 35.24 },
  IL: { name: 'Israel', lat: 31.05, lng: 34.85 },
  SA: { name: 'Saudi Arabia', lat: 23.89, lng: 45.08 },
  AE: { name: 'United Arab Emirates', lat: 23.42, lng: 53.85 },
  EG: { name: 'Egypt', lat: 26.82, lng: 30.80 },
  ZA: { name: 'South Africa', lat: -30.56, lng: 22.94 },
  NG: { name: 'Nigeria', lat: 9.08, lng: 8.68 },
  KE: { name: 'Kenya', lat: -0.02, lng: 37.91 },
  GH: { name: 'Ghana', lat: 7.95, lng: -1.02 },
  MA: { name: 'Morocco', lat: 31.79, lng: -7.09 },
  IN: { name: 'India', lat: 20.59, lng: 78.96 },
  PK: { name: 'Pakistan', lat: 30.38, lng: 69.35 },
  BD: { name: 'Bangladesh', lat: 23.68, lng: 90.36 },
  LK: { name: 'Sri Lanka', lat: 7.87, lng: 80.77 },
  CN: { name: 'China', lat: 35.86, lng: 104.20 },
  JP: { name: 'Japan', lat: 36.20, lng: 138.25 },
  KR: { name: 'South Korea', lat: 35.91, lng: 127.77 },
  TW: { name: 'Taiwan', lat: 23.70, lng: 120.96 },
  HK: { name: 'Hong Kong', lat: 22.32, lng: 114.17 },
  SG: { name: 'Singapore', lat: 1.35, lng: 103.82 },
  MY: { name: 'Malaysia', lat: 4.21, lng: 101.98 },
  TH: { name: 'Thailand', lat: 15.87, lng: 100.99 },
  VN: { name: 'Vietnam', lat: 14.06, lng: 108.28 },
  PH: { name: 'Philippines', lat: 12.88, lng: 121.77 },
  ID: { name: 'Indonesia', lat: -0.79, lng: 113.92 },
  AU: { name: 'Australia', lat: -25.27, lng: 133.78 },
  NZ: { name: 'New Zealand', lat: -40.90, lng: 174.89 },
  CL: { name: 'Chile', lat: -35.68, lng: -71.54 },
  CO: { name: 'Colombia', lat: 4.57, lng: -74.30 },
  PE: { name: 'Peru', lat: -9.19, lng: -75.02 },
  VE: { name: 'Venezuela', lat: 6.42, lng: -66.59 },
  CR: { name: 'Costa Rica', lat: 9.75, lng: -83.75 },
  CU: { name: 'Cuba', lat: 21.52, lng: -77.78 },
}

export function resolvePinPosition(opts: {
  countryCode: string | null
  latitude: number | null
  longitude: number | null
}): [number, number] | null {
  if (opts.latitude !== null && opts.longitude !== null) {
    return [opts.latitude, opts.longitude]
  }
  if (opts.countryCode) {
    const c = COUNTRY_CENTROIDS[opts.countryCode]
    if (c) return [c.lat, c.lng]
  }
  return null
}

export const COUNTRY_OPTIONS = Object.entries(COUNTRY_CENTROIDS)
  .map(([code, meta]) => ({ code, name: meta.name }))
  .sort((a, b) => a.name.localeCompare(b.name))
