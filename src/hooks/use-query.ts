'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient, type ApiError, type ApiResponse, type RequestConfig } from '@/lib/api-client'

// ============================================================================
// Types
// ============================================================================

export interface UseQueryOptions<TData> extends Omit<RequestConfig, 'cache'> {
  /** Whether the query should execute immediately */
  enabled?: boolean
  /** Time in milliseconds to consider data fresh */
  staleTime?: number
  /** Time in milliseconds to keep data in cache */
  cacheTime?: number
  /** Enable stale-while-revalidate pattern */
  staleWhileRevalidate?: boolean
  /** Callback when query succeeds */
  onSuccess?: (data: TData) => void
  /** Callback when query fails */
  onError?: (error: ApiError) => void
  /** Callback when query settles (success or error) */
  onSettled?: (data: TData | undefined, error: ApiError | null) => void
  /** Refetch interval in milliseconds */
  refetchInterval?: number
  /** Refetch when window regains focus */
  refetchOnWindowFocus?: boolean
  /** Refetch when connection is restored */
  refetchOnReconnect?: boolean
  /** Initial data to use before fetch completes */
  initialData?: TData
  /** Placeholder data to show while loading */
  placeholderData?: TData
  /** Keep previous data while new data is loading */
  keepPreviousData?: boolean
  /** Custom equality function for data comparison */
  isDataEqual?: (oldData: TData | undefined, newData: TData) => boolean
}

export interface UseQueryResult<TData> {
  /** The fetched data */
  data: TData | undefined
  /** Error from the last fetch attempt */
  error: ApiError | null
  /** True if the query is currently fetching */
  isLoading: boolean
  /** True if data has never been fetched */
  isInitialLoading: boolean
  /** True if the query is refetching */
  isRefetching: boolean
  /** True if the query succeeded */
  isSuccess: boolean
  /** True if the query failed */
  isError: boolean
  /** True if there is data available */
  hasData: boolean
  /** True if the current data is stale */
  isStale: boolean
  /** True if showing placeholder data */
  isPlaceholderData: boolean
  /** True if showing previous data */
  isPreviousData: boolean
  /** Current status of the query */
  status: 'idle' | 'loading' | 'success' | 'error'
  /** Function to manually refetch data */
  refetch: () => Promise<void>
  /** Function to invalidate and refetch */
  invalidate: () => Promise<void>
}

interface QueryState<TData> {
  data: TData | undefined
  error: ApiError | null
  status: 'idle' | 'loading' | 'success' | 'error'
  dataUpdatedAt: number | null
  isPlaceholderData: boolean
  isPreviousData: boolean
}

// ============================================================================
// Cache for Cross-Component Sharing
// ============================================================================

interface CacheEntry<TData> {
  data: TData
  dataUpdatedAt: number
  subscribers: Set<() => void>
}

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  get<TData>(key: string): CacheEntry<TData> | undefined {
    return this.cache.get(key) as CacheEntry<TData> | undefined
  }

  set<TData>(key: string, data: TData, dataUpdatedAt: number): void {
    const existing = this.cache.get(key)
    const entry: CacheEntry<TData> = {
      data,
      dataUpdatedAt,
      subscribers: existing?.subscribers ?? new Set(),
    }
    this.cache.set(key, entry as CacheEntry<unknown>)
    // Notify all subscribers
    entry.subscribers.forEach((callback) => callback())
  }

  subscribe(key: string, callback: () => void): () => void {
    let entry = this.cache.get(key)
    if (!entry) {
      entry = { data: undefined, dataUpdatedAt: 0, subscribers: new Set() }
      this.cache.set(key, entry)
    }
    entry.subscribers.add(callback)
    return () => {
      entry?.subscribers.delete(callback)
    }
  }

  invalidate(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      entry.dataUpdatedAt = 0 // Mark as stale
      entry.subscribers.forEach((callback) => callback())
    }
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

export const queryCache = new QueryCache()

// ============================================================================
// Hook Implementation
// ============================================================================

export function useQuery<TData>(
  key: string | string[],
  fetcher: (() => Promise<TData>) | string,
  options: UseQueryOptions<TData> = {}
): UseQueryResult<TData> {
  const {
    enabled = true,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate = true,
    onSuccess,
    onError,
    onSettled,
    refetchInterval,
    refetchOnWindowFocus = true,
    refetchOnReconnect = true,
    initialData,
    placeholderData,
    keepPreviousData = false,
    isDataEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b),
    ...fetchConfig
  } = options

  // Normalize key to string
  const queryKey = Array.isArray(key) ? key.join(':') : key

  // Determine the fetch function
  const fetchFn = useCallback(async (): Promise<TData> => {
    if (typeof fetcher === 'string') {
      const response: ApiResponse<TData> = await apiClient.get<TData>(fetcher, {
        ...fetchConfig,
        cache: {
          enabled: false, // We manage caching ourselves
        },
      })
      return response.data
    }
    return fetcher()
  }, [fetcher, fetchConfig])

  // Initialize state
  const [state, setState] = useState<QueryState<TData>>(() => {
    // Check cache first
    const cached = queryCache.get<TData>(queryKey)
    if (cached?.data !== undefined) {
      const isStale = Date.now() - cached.dataUpdatedAt > staleTime
      return {
        data: cached.data,
        error: null,
        status: 'success',
        dataUpdatedAt: cached.dataUpdatedAt,
        isPlaceholderData: false,
        isPreviousData: false,
      }
    }

    // Use initial data if provided
    if (initialData !== undefined) {
      return {
        data: initialData,
        error: null,
        status: 'success',
        dataUpdatedAt: Date.now(),
        isPlaceholderData: false,
        isPreviousData: false,
      }
    }

    // Use placeholder data if provided
    if (placeholderData !== undefined) {
      return {
        data: placeholderData,
        error: null,
        status: 'loading',
        dataUpdatedAt: null,
        isPlaceholderData: true,
        isPreviousData: false,
      }
    }

    return {
      data: undefined,
      error: null,
      status: 'idle',
      dataUpdatedAt: null,
      isPlaceholderData: false,
      isPreviousData: false,
    }
  })

  const isMountedRef = useRef(true)
  const fetchCountRef = useRef(0)
  const previousDataRef = useRef<TData | undefined>(state.data)

  // Calculate derived states
  const isStale =
    state.dataUpdatedAt !== null && Date.now() - state.dataUpdatedAt > staleTime

  const isLoading = state.status === 'loading'
  const isInitialLoading = isLoading && state.data === undefined && !state.isPlaceholderData
  const isRefetching = isLoading && (state.data !== undefined || state.isPlaceholderData)
  const isSuccess = state.status === 'success'
  const isError = state.status === 'error'
  const hasData = state.data !== undefined

  // Fetch data function
  const fetchData = useCallback(
    async (background = false) => {
      if (!enabled) return

      const currentFetchCount = ++fetchCountRef.current

      // Set loading state
      setState((prev) => {
        const newState: QueryState<TData> = {
          ...prev,
          status: 'loading',
          error: null,
        }

        // Keep previous data if enabled and we have data
        if (keepPreviousData && prev.data !== undefined) {
          previousDataRef.current = prev.data
          newState.isPreviousData = true
        }

        return newState
      })

      try {
        const data = await fetchFn()

        // Only update if this is still the latest fetch
        if (currentFetchCount !== fetchCountRef.current || !isMountedRef.current) {
          return
        }

        // Check if data has changed
        const hasChanged = !isDataEqual(state.data, data)

        if (hasChanged || state.status !== 'success') {
          const now = Date.now()

          // Update cache
          queryCache.set(queryKey, data, now)

          // Update state
          setState({
            data,
            error: null,
            status: 'success',
            dataUpdatedAt: now,
            isPlaceholderData: false,
            isPreviousData: false,
          })
        }

        onSuccess?.(data)
        onSettled?.(data, null)
      } catch (error) {
        // Only update if this is still the latest fetch
        if (currentFetchCount !== fetchCountRef.current || !isMountedRef.current) {
          return
        }

        const apiError = error as ApiError

        setState((prev) => ({
          ...prev,
          error: apiError,
          status: 'error',
          isPlaceholderData: false,
          // Keep previous data on error if keepPreviousData is enabled
          isPreviousData: keepPreviousData && prev.data !== undefined,
        }))

        onError?.(apiError)
        onSettled?.(state.data, apiError)
      }
    },
    [
      enabled,
      fetchFn,
      queryKey,
      keepPreviousData,
      isDataEqual,
      state.data,
      state.status,
      onSuccess,
      onError,
      onSettled,
    ]
  )

  // Refetch function (exposed to users)
  const refetch = useCallback(async () => {
    await fetchData(false)
  }, [fetchData])

  // Invalidate and refetch
  const invalidate = useCallback(async () => {
    queryCache.invalidate(queryKey)
    await fetchData(false)
  }, [queryKey, fetchData])

  // Initial fetch and stale-while-revalidate
  useEffect(() => {
    if (!enabled) return

    const cached = queryCache.get<TData>(queryKey)
    const isStaleData =
      cached?.dataUpdatedAt !== undefined &&
      Date.now() - cached.dataUpdatedAt > staleTime

    // Fetch if no cached data or data is stale
    if (!cached?.data || isStaleData) {
      fetchData(cached?.data !== undefined && staleWhileRevalidate)
    }
  }, [enabled, queryKey, staleTime, staleWhileRevalidate, fetchData])

  // Subscribe to cache updates
  useEffect(() => {
    return queryCache.subscribe(queryKey, () => {
      const cached = queryCache.get<TData>(queryKey)
      if (cached?.data !== undefined && !isDataEqual(state.data, cached.data)) {
        setState((prev) => ({
          ...prev,
          data: cached.data,
          dataUpdatedAt: cached.dataUpdatedAt,
          status: 'success',
          error: null,
          isPlaceholderData: false,
          isPreviousData: false,
        }))
      }
    })
  }, [queryKey, state.data, isDataEqual])

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return

    const interval = setInterval(() => {
      fetchData(true)
    }, refetchInterval)

    return () => clearInterval(interval)
  }, [refetchInterval, enabled, fetchData])

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled || typeof window === 'undefined') return

    const handleFocus = () => {
      if (isStale) {
        fetchData(staleWhileRevalidate)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchOnWindowFocus, enabled, isStale, staleWhileRevalidate, fetchData])

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect || !enabled || typeof window === 'undefined') return

    const handleOnline = () => {
      fetchData(staleWhileRevalidate)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refetchOnReconnect, enabled, staleWhileRevalidate, fetchData])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Cache cleanup on unmount (with cacheTime delay)
  useEffect(() => {
    return () => {
      if (cacheTime > 0) {
        setTimeout(() => {
          // Only delete if no subscribers remain
          const entry = queryCache.get(queryKey)
          if (entry && entry.subscribers.size === 0) {
            queryCache.delete(queryKey)
          }
        }, cacheTime)
      }
    }
  }, [queryKey, cacheTime])

  return {
    data: state.data,
    error: state.error,
    isLoading,
    isInitialLoading,
    isRefetching,
    isSuccess,
    isError,
    hasData,
    isStale,
    isPlaceholderData: state.isPlaceholderData,
    isPreviousData: state.isPreviousData,
    status: state.status,
    refetch,
    invalidate,
  }
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * A simpler version of useQuery for basic use cases
 */
export function useFetch<TData>(
  url: string,
  options?: Omit<UseQueryOptions<TData>, 'fetcher'>
): UseQueryResult<TData> {
  return useQuery<TData>(url, url, options)
}

/**
 * Query with pagination support
 */
export interface UsePaginatedQueryOptions<TData> extends UseQueryOptions<TData> {
  page?: number
  pageSize?: number
}

export interface UsePaginatedQueryResult<TData> extends UseQueryResult<TData> {
  page: number
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
}

export function usePaginatedQuery<TData>(
  baseKey: string,
  fetcher: (page: number, pageSize: number) => Promise<TData>,
  options: UsePaginatedQueryOptions<TData> = {}
): UsePaginatedQueryResult<TData> {
  const { page: initialPage = 1, pageSize = 10, ...queryOptions } = options
  const [page, setPage] = useState(initialPage)

  const queryKey = `${baseKey}:page=${page}:pageSize=${pageSize}`
  const result = useQuery<TData>(
    queryKey,
    () => fetcher(page, pageSize),
    {
      ...queryOptions,
      keepPreviousData: true,
    }
  )

  const nextPage = useCallback(() => setPage((p) => p + 1), [])
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), [])

  return {
    ...result,
    page,
    setPage,
    nextPage,
    prevPage,
  }
}

/**
 * Query with infinite loading support
 */
export interface UseInfiniteQueryOptions<TData, TPageParam = number>
  extends Omit<UseQueryOptions<TData[]>, 'initialData'> {
  getNextPageParam: (lastPage: TData, allPages: TData[]) => TPageParam | undefined
  initialPageParam?: TPageParam
}

export interface UseInfiniteQueryResult<TData> {
  data: TData[]
  error: ApiError | null
  isLoading: boolean
  isLoadingMore: boolean
  isError: boolean
  hasNextPage: boolean
  fetchNextPage: () => Promise<void>
  refetch: () => Promise<void>
}

export function useInfiniteQuery<TData, TPageParam = number>(
  key: string,
  fetcher: (pageParam: TPageParam) => Promise<TData>,
  options: UseInfiniteQueryOptions<TData, TPageParam>
): UseInfiniteQueryResult<TData> {
  const {
    getNextPageParam,
    initialPageParam = 1 as TPageParam,
    onSuccess,
    onError,
    ...queryOptions
  } = options

  const [pages, setPages] = useState<TData[]>([])
  const [nextPageParam, setNextPageParam] = useState<TPageParam | undefined>(
    initialPageParam
  )
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isMountedRef = useRef(true)

  const fetchPage = useCallback(
    async (pageParam: TPageParam, isInitial = false) => {
      if (isInitial) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)

      try {
        const data = await fetcher(pageParam)

        if (!isMountedRef.current) return

        setPages((prev) => {
          const newPages = isInitial ? [data] : [...prev, data]
          const nextParam = getNextPageParam(data, newPages)
          setNextPageParam(nextParam)
          onSuccess?.(newPages)
          return newPages
        })
      } catch (e) {
        if (!isMountedRef.current) return
        const apiError = e as ApiError
        setError(apiError)
        onError?.(apiError)
      } finally {
        if (isMountedRef.current) {
          if (isInitial) {
            setIsLoading(false)
          } else {
            setIsLoadingMore(false)
          }
        }
      }
    },
    [fetcher, getNextPageParam, onSuccess, onError]
  )

  // Initial fetch
  useEffect(() => {
    fetchPage(initialPageParam, true)
  }, [key, initialPageParam, fetchPage])

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchNextPage = useCallback(async () => {
    if (nextPageParam === undefined || isLoadingMore) return
    await fetchPage(nextPageParam)
  }, [nextPageParam, isLoadingMore, fetchPage])

  const refetch = useCallback(async () => {
    setPages([])
    setNextPageParam(initialPageParam)
    await fetchPage(initialPageParam, true)
  }, [initialPageParam, fetchPage])

  return {
    data: pages,
    error,
    isLoading,
    isLoadingMore,
    isError: error !== null,
    hasNextPage: nextPageParam !== undefined,
    fetchNextPage,
    refetch,
  }
}
