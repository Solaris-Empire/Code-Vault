// Central beta-feature gating.
//
// Production = ONLY the 100%-verified core marketplace (buyers +
// sellers + products + reviews + ranks/tiers). Everything else is
// dev/preview only until Kevin signs it off.
//
// Vercel exposes VERCEL_ENV: 'production' | 'preview' | 'development'.
// We treat anything other than 'production' as beta-open. Individual
// features can still be forced on in prod via explicit env vars, so
// once something is verified you can flip its flag without waiting
// on the next deploy cycle.
//
// Usage:
//   isBetaEnabled('jobs')          // boolean
//   requireBetaFeature('jobs')     // throws notFound() in server code
//
// Client usage (for hiding nav links):
//   import { BETA_FLAGS_CLIENT } from '@/lib/feature-flags'
//   if (!BETA_FLAGS_CLIENT.jobs) return null

import 'server-only'
import { notFound } from 'next/navigation'

export type BetaFeatureKey =
  | 'journey'
  | 'community_map'
  | 'community_feed'
  | 'hire'
  | 'jobs'

// Map feature key → the env var that force-enables it in production.
// Example: set FEATURE_JOBS=1 in Vercel → /jobs becomes live in prod.
const PROD_OVERRIDE_ENV: Record<BetaFeatureKey, string> = {
  journey:         'FEATURE_JOURNEY',
  community_map:   'FEATURE_COMMUNITY_MAP',
  community_feed:  'FEATURE_COMMUNITY_FEED',
  hire:            'FEATURE_HIRE',
  jobs:            'FEATURE_JOBS',
}

function isProduction(): boolean {
  // VERCEL_ENV is the authoritative signal on Vercel. Fall back to
  // NODE_ENV for local runs where VERCEL_ENV is undefined — but
  // treat local `next dev` as non-production (it's a dev env).
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv) return vercelEnv === 'production'
  return process.env.NODE_ENV === 'production'
}

export function isBetaEnabled(key: BetaFeatureKey): boolean {
  if (!isProduction()) return true
  const overrideVar = PROD_OVERRIDE_ENV[key]
  const override = process.env[overrideVar]
  return override === '1' || override === 'true'
}

// Server-only guard — call this at the top of a page/route. Renders
// a 404 if the feature is gated.
export function requireBetaFeature(key: BetaFeatureKey): void {
  if (!isBetaEnabled(key)) notFound()
}

// Snapshot all flags for the client (so the header can hide nav
// links without importing server-only code). Built on the server at
// request time, passed down as a prop.
export function getBetaFlagsForClient(): Record<BetaFeatureKey, boolean> {
  return {
    journey:        isBetaEnabled('journey'),
    community_map:  isBetaEnabled('community_map'),
    community_feed: isBetaEnabled('community_feed'),
    hire:           isBetaEnabled('hire'),
    jobs:           isBetaEnabled('jobs'),
  }
}
