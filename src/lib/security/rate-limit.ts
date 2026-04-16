import { NextRequest, NextResponse } from 'next/server'
import { getClientIP } from './ip'

interface RateLimitRecord {
  count: number
  resetTime: number
}

// ─── Store interface ───────────────────────────────────────────────
// Async so the same shape supports both the in-process Map (fast path
// for single-instance dev) and an out-of-process store like Upstash
// Redis (required for multi-instance Vercel so one client can't split
// their burst across Lambdas and escape the limit).
interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<RateLimitRecord>
}

// ─── In-memory store ───────────────────────────────────────────────
// Per-Lambda only. Good for local dev and as a fallback; in prod on
// Vercel each instance keeps its own counter so the effective limit
// is N × the configured limit. Upstash fixes that.
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitRecord>()

  async incr(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now()
    const existing = this.store.get(key)
    if (!existing || existing.resetTime < now) {
      const record = { count: 1, resetTime: now + windowMs }
      this.store.set(key, record)
      return record
    }
    existing.count++
    return existing
  }

  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime < now) this.store.delete(key)
    }
  }
}

// ─── Upstash Redis store ───────────────────────────────────────────
// Uses the Upstash REST API (no persistent connection — works in
// serverless). Atomic INCR + conditional EXPIRE gives a fixed-window
// counter that's consistent across Lambdas.
//
// Activated automatically when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// are set. Falls back to memory otherwise so dev never breaks.
class UpstashRateLimitStore implements RateLimitStore {
  constructor(private url: string, private token: string) {}

  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      // Rate-limit checks must not be cached by any edge CDN or stale.
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`)
    return res.json() as Promise<unknown[]>
  }

  async incr(key: string, windowMs: number): Promise<RateLimitRecord> {
    const windowSec = Math.ceil(windowMs / 1000)
    // INCR returns the new count. PEXPIRE with NX only sets the TTL
    // if no TTL is set — so the window starts when the first request
    // of a window arrives, and subsequent requests don't reset it.
    // PTTL reports remaining ms so we can surface resetTime to clients.
    const results = await this.pipeline([
      ['INCR', key],
      ['PEXPIRE', key, windowMs, 'NX'],
      ['PTTL', key],
    ])
    // Upstash pipeline returns [{ result }, { result }, ...]
    const countResult = (results[0] as { result: number } | number)
    const ttlResult = (results[2] as { result: number } | number)
    const count = typeof countResult === 'number' ? countResult : countResult.result
    const pttl = typeof ttlResult === 'number' ? ttlResult : ttlResult.result
    // PTTL returns -1 if no TTL is set (shouldn't happen post-PEXPIRE-NX
    // but guard anyway) and -2 if the key doesn't exist.
    const remainingMs = pttl > 0 ? pttl : windowSec * 1000
    return { count, resetTime: Date.now() + remainingMs }
  }
}

// ─── Store selection ───────────────────────────────────────────────
// Picked once at module load. We prefer Upstash when creds are set so
// multi-instance deployments share counters; otherwise we fall back
// to memory so local dev and single-instance envs still rate-limit.
function selectStore(): RateLimitStore {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return new UpstashRateLimitStore(url, token)
  return new MemoryRateLimitStore()
}

const rateLimitStore: RateLimitStore = selectStore()

// Memory-store cleanup only runs when we're on memory (no-op for Redis).
if (rateLimitStore instanceof MemoryRateLimitStore) {
  setInterval(() => (rateLimitStore as MemoryRateLimitStore).cleanup(), 60000)
}

export interface RateLimitConfig {
  limit: number
  windowMs: number
  prefix?: string
  keyGenerator?: (request: NextRequest) => string
  skip?: (request: NextRequest) => boolean
  message?: string
}

export interface RateLimitResult {
  success: boolean
  allowed: boolean
  remaining: number
  resetTime: number
  identifier: string
  limit: number
  error?: NextResponse
}

export const rateLimitConfigs = {
  auth: {
    limit: 5,
    windowMs: 60 * 1000,
    prefix: 'auth',
    message: 'Too many authentication attempts. Please try again in a minute.'
  },
  upload: {
    limit: 10,
    windowMs: 5 * 60 * 1000,
    prefix: 'upload',
    message: 'Too many uploads. Please wait before uploading more files.'
  },
  review: {
    limit: 5,
    windowMs: 60 * 1000,
    prefix: 'review',
    message: 'Too many reviews submitted. Please wait before submitting more.'
  },
  order: {
    limit: 20,
    windowMs: 60 * 1000,
    prefix: 'order',
    message: 'Too many order requests. Please slow down.'
  },
  api: {
    limit: 100,
    windowMs: 60 * 1000,
    prefix: 'api',
    message: 'Too many requests. Please slow down.'
  },
  sensitive: {
    limit: 3,
    windowMs: 60 * 1000,
    prefix: 'sensitive',
    message: 'Too many attempts. Please try again later.'
  }
}

function getClientIdentifier(request: NextRequest): string {
  return getClientIP(request)
}

// ─── Check rate limit ──────────────────────────────────────────────
// Async — required so we can talk to Upstash. When the store is
// in-memory the Promise resolves synchronously so overhead is near
// zero. If the Redis call throws, we fail open (allow the request)
// rather than blocking legitimate traffic on an infrastructure blip.
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = rateLimitConfigs.api
): Promise<RateLimitResult> {
  const identifier = config.keyGenerator
    ? config.keyGenerator(request)
    : getClientIdentifier(request)

  if (config.skip && config.skip(request)) {
    return {
      success: true,
      allowed: true,
      remaining: config.limit,
      resetTime: Date.now() + config.windowMs,
      identifier,
      limit: config.limit
    }
  }

  const key = `${config.prefix || 'default'}:${identifier}`

  let record: RateLimitRecord
  try {
    record = await rateLimitStore.incr(key, config.windowMs)
  } catch {
    // Fail open on store outage — rate-limiting is a defensive layer,
    // not an auth check, and blocking everyone on a Redis hiccup is
    // worse than temporarily under-limiting.
    return {
      success: true,
      allowed: true,
      remaining: config.limit,
      resetTime: Date.now() + config.windowMs,
      identifier,
      limit: config.limit,
    }
  }

  if (record.count > config.limit) {
    const now = Date.now()
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)

    return {
      success: false,
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      identifier,
      limit: config.limit,
      error: NextResponse.json(
        {
          error: config.message || 'Too many requests',
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(record.resetTime / 1000))
          }
        }
      )
    }
  }

  return {
    success: true,
    allowed: true,
    remaining: config.limit - record.count,
    resetTime: record.resetTime,
    identifier,
    limit: config.limit
  }
}

export function rateLimit(config: RateLimitConfig = rateLimitConfigs.api) {
  return (request: NextRequest): Promise<RateLimitResult> => checkRateLimit(request, config)
}

export function createRateLimiter(config: Partial<RateLimitConfig>) {
  const finalConfig = { ...rateLimitConfigs.api, ...config }
  return (request: NextRequest) => checkRateLimit(request, finalConfig)
}

export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)))
  return response
}
