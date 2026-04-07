/**
 * Type-safe API Client with advanced features
 * - Automatic error handling
 * - Request/response interceptors
 * - Retry logic with exponential backoff
 * - Request deduplication
 * - Cache support
 */

// ============================================================================
// Types
// ============================================================================

export interface ApiError extends Error {
  status: number
  statusText: string
  data?: unknown
  isNetworkError: boolean
  isTimeout: boolean
  retryable: boolean
}

export interface RequestConfig<TBody = unknown> extends Omit<RequestInit, 'body' | 'cache'> {
  baseUrl?: string
  params?: Record<string, string | number | boolean | undefined | null>
  body?: TBody
  timeout?: number
  retry?: RetryConfig
  cache?: CacheConfig
  dedupe?: boolean
  interceptors?: {
    request?: RequestInterceptor[]
    response?: ResponseInterceptor[]
  }
}

export interface RetryConfig {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  shouldRetry?: (error: ApiError, attempt: number, maxRetries?: number) => boolean
}

export interface CacheConfig {
  enabled?: boolean
  ttl?: number // Time to live in milliseconds
  key?: string // Custom cache key
  staleWhileRevalidate?: boolean
}

export type RequestInterceptor = (
  url: string,
  config: RequestConfig
) => Promise<{ url: string; config: RequestConfig }> | { url: string; config: RequestConfig }

export type ResponseInterceptor<T = unknown> = (
  response: ApiResponse<T>
) => Promise<ApiResponse<T>> | ApiResponse<T>

export interface ApiResponse<T> {
  data: T
  status: number
  statusText: string
  headers: Headers
  ok: boolean
  cached?: boolean
  stale?: boolean
}

interface CacheEntry<T> {
  data: ApiResponse<T>
  timestamp: number
  ttl: number
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 30000 // 30 seconds
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY = 1000 // 1 second
const DEFAULT_MAX_DELAY = 30000 // 30 seconds
const DEFAULT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// HTTP status codes that should trigger retry
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

// ============================================================================
// Cache
// ============================================================================

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize = 100

  set<T>(key: string, data: ApiResponse<T>, ttl: number): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  get<T>(key: string): { data: ApiResponse<T>; stale: boolean } | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    const isStale = age > entry.ttl

    return { data: entry.data, stale: isStale }
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }
}

// ============================================================================
// Request Deduplication
// ============================================================================

class RequestDeduplicator {
  private inflight = new Map<string, Promise<ApiResponse<unknown>>>()

  async dedupe<T>(
    key: string,
    request: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    // Check if request is already in flight
    const existing = this.inflight.get(key)
    if (existing) {
      return existing as Promise<ApiResponse<T>>
    }

    // Create new request and store it
    const promise = request().finally(() => {
      this.inflight.delete(key)
    })

    this.inflight.set(key, promise as Promise<ApiResponse<unknown>>)
    return promise
  }

  isInflight(key: string): boolean {
    return this.inflight.has(key)
  }
}

// ============================================================================
// Error Creation
// ============================================================================

function createApiError(
  message: string,
  options: Partial<Omit<ApiError, 'name' | 'message'>>
): ApiError {
  const error = new Error(message) as ApiError
  error.name = 'ApiError'
  error.status = options.status ?? 0
  error.statusText = options.statusText ?? ''
  error.data = options.data
  error.isNetworkError = options.isNetworkError ?? false
  error.isTimeout = options.isTimeout ?? false
  error.retryable = options.retryable ?? false
  return error
}

// ============================================================================
// Utility Functions
// ============================================================================

function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const url = new URL(path, baseUrl)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    })
  }

  return url.toString()
}

function generateCacheKey(method: string, url: string, body?: unknown): string {
  const bodyStr = body ? JSON.stringify(body) : ''
  return `${method}:${url}:${bodyStr}`
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function calculateBackoff(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

function shouldRetryRequest(error: ApiError, attempt: number, maxRetries?: number): boolean {
  if (maxRetries !== undefined && attempt >= maxRetries) return false
  if (error.isTimeout) return true
  if (error.isNetworkError) return true
  if (RETRYABLE_STATUS_CODES.includes(error.status)) return true
  return false
}

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private baseUrl: string
  private defaultConfig: RequestConfig
  private cache: RequestCache
  private deduplicator: RequestDeduplicator
  private globalInterceptors: {
    request: RequestInterceptor[]
    response: ResponseInterceptor[]
  }

  constructor(baseUrl: string = '', defaultConfig: RequestConfig = {}) {
    this.baseUrl = baseUrl
    this.defaultConfig = defaultConfig
    this.cache = new RequestCache()
    this.deduplicator = new RequestDeduplicator()
    this.globalInterceptors = {
      request: [],
      response: [],
    }
  }

  // ---------------------------------------------------------------------------
  // Interceptor Management
  // ---------------------------------------------------------------------------

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.globalInterceptors.request.push(interceptor)
    return () => {
      const index = this.globalInterceptors.request.indexOf(interceptor)
      if (index > -1) {
        this.globalInterceptors.request.splice(index, 1)
      }
    }
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.globalInterceptors.response.push(interceptor)
    return () => {
      const index = this.globalInterceptors.response.indexOf(interceptor)
      if (index > -1) {
        this.globalInterceptors.response.splice(index, 1)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

  clearCache(): void {
    this.cache.clear()
  }

  invalidateCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear()
      return
    }
    // Note: For full pattern matching, we'd need to iterate cache keys
    // This is a simplified version
    if (typeof pattern === 'string') {
      this.cache.delete(pattern)
    }
  }

  // ---------------------------------------------------------------------------
  // Core Request Method
  // ---------------------------------------------------------------------------

  async request<TResponse, TBody = unknown>(
    method: string,
    path: string,
    config: RequestConfig<TBody> = {}
  ): Promise<ApiResponse<TResponse>> {
    const mergedConfig = {
      ...this.defaultConfig,
      ...config,
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultConfig.headers,
        ...config.headers,
      },
    } as RequestConfig<TBody>

    const baseUrl = mergedConfig.baseUrl ?? this.baseUrl
    let url = buildUrl(baseUrl, path, mergedConfig.params)

    // Apply request interceptors
    const requestInterceptors = [
      ...this.globalInterceptors.request,
      ...(mergedConfig.interceptors?.request ?? []),
    ]

    for (const interceptor of requestInterceptors) {
      const result = await interceptor(url, mergedConfig)
      url = result.url
      Object.assign(mergedConfig, result.config)
    }

    // Generate cache key
    const cacheKey =
      mergedConfig.cache?.key ??
      generateCacheKey(method, url, mergedConfig.body)

    // Check cache for GET requests
    if (
      method === 'GET' &&
      mergedConfig.cache?.enabled !== false
    ) {
      const cached = this.cache.get<TResponse>(cacheKey)
      if (cached) {
        if (!cached.stale) {
          return { ...cached.data, cached: true, stale: false }
        }

        // Stale-while-revalidate: return stale data and revalidate in background
        if (mergedConfig.cache?.staleWhileRevalidate) {
          this.executeRequest<TResponse, TBody>(method, url, mergedConfig, cacheKey).catch(
            () => {} // Silently ignore background revalidation errors
          )
          return { ...cached.data, cached: true, stale: true }
        }
      }
    }

    // Handle request deduplication for GET requests
    if (method === 'GET' && mergedConfig.dedupe !== false) {
      return this.deduplicator.dedupe(cacheKey, () =>
        this.executeRequest<TResponse, TBody>(method, url, mergedConfig, cacheKey)
      )
    }

    return this.executeRequest<TResponse, TBody>(method, url, mergedConfig, cacheKey)
  }

  private async executeRequest<TResponse, TBody>(
    method: string,
    url: string,
    config: RequestConfig<TBody>,
    cacheKey: string
  ): Promise<ApiResponse<TResponse>> {
    const retryConfig: Required<RetryConfig> = {
      maxRetries: config.retry?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelay: config.retry?.baseDelay ?? DEFAULT_BASE_DELAY,
      maxDelay: config.retry?.maxDelay ?? DEFAULT_MAX_DELAY,
      shouldRetry: config.retry?.shouldRetry ?? shouldRetryRequest,
    }

    let lastError: ApiError | null = null

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout<TResponse, TBody>(
          method,
          url,
          config
        )

        // Apply response interceptors
        let processedResponse = response
        const responseInterceptors = [
          ...this.globalInterceptors.response,
          ...(config.interceptors?.response ?? []),
        ]

        for (const interceptor of responseInterceptors) {
          processedResponse = (await interceptor(
            processedResponse
          )) as ApiResponse<TResponse>
        }

        // Cache successful GET responses
        if (method === 'GET' && processedResponse.ok && config.cache?.enabled !== false) {
          const ttl = config.cache?.ttl ?? DEFAULT_CACHE_TTL
          this.cache.set(cacheKey, processedResponse, ttl)
        }

        return processedResponse
      } catch (error) {
        lastError = error as ApiError

        const shouldRetry = retryConfig.shouldRetry(
          lastError,
          attempt,
          retryConfig.maxRetries
        )

        if (shouldRetry && attempt < retryConfig.maxRetries) {
          const delay = calculateBackoff(
            attempt,
            retryConfig.baseDelay,
            retryConfig.maxDelay
          )
          await sleep(delay)
          continue
        }

        throw lastError
      }
    }

    throw lastError ?? createApiError('Request failed', { retryable: false })
  }

  private async fetchWithTimeout<TResponse, TBody>(
    method: string,
    url: string,
    config: RequestConfig<TBody>
  ): Promise<ApiResponse<TResponse>> {
    const timeout = config.timeout ?? DEFAULT_TIMEOUT
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const fetchConfig: RequestInit = {
        method,
        headers: config.headers as HeadersInit,
        signal: controller.signal,
        credentials: config.credentials,
        mode: config.mode,
        cache: config.cache?.enabled === false ? 'no-store' : undefined,
      }

      if (config.body !== undefined && method !== 'GET' && method !== 'HEAD') {
        fetchConfig.body = JSON.stringify(config.body)
      }

      const response = await fetch(url, fetchConfig)

      // Parse response body
      let data: TResponse
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (contentType?.includes('text/')) {
        data = (await response.text()) as unknown as TResponse
      } else {
        // Try JSON first, fall back to text
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          data = text as unknown as TResponse
        }
      }

      if (!response.ok) {
        const retryable = RETRYABLE_STATUS_CODES.includes(response.status)
        throw createApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          {
            status: response.status,
            statusText: response.statusText,
            data,
            retryable,
          }
        )
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: true,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw createApiError('Request timeout', {
          isTimeout: true,
          retryable: true,
        })
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw createApiError('Network error', {
          isNetworkError: true,
          retryable: true,
        })
      }

      // Re-throw ApiError
      if ((error as ApiError).name === 'ApiError') {
        throw error
      }

      throw createApiError(
        error instanceof Error ? error.message : 'Unknown error',
        { retryable: false }
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP Method Shortcuts
  // ---------------------------------------------------------------------------

  async get<TResponse>(
    path: string,
    config?: RequestConfig
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>('GET', path, config)
  }

  async post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody>('POST', path, { ...config, body })
  }

  async put<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody>('PUT', path, { ...config, body })
  }

  async patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse, TBody>('PATCH', path, { ...config, body })
  }

  async delete<TResponse>(
    path: string,
    config?: RequestConfig
  ): Promise<ApiResponse<TResponse>> {
    return this.request<TResponse>('DELETE', path, config)
  }
}

// ============================================================================
// Default Instance
// ============================================================================

export const apiClient = new ApiClient(
  typeof window !== 'undefined' ? window.location.origin : ''
)

// Add default request interceptor for auth token
if (typeof window !== 'undefined') {
  apiClient.addRequestInterceptor(async (url, config) => {
    // You can add auth token here
    // const token = localStorage.getItem('auth_token')
    // if (token) {
    //   config.headers = {
    //     ...config.headers,
    //     Authorization: `Bearer ${token}`,
    //   }
    // }
    return { url, config }
  })
}

// ============================================================================
// Utility Exports
// ============================================================================

export { createApiError, buildUrl, generateCacheKey }
