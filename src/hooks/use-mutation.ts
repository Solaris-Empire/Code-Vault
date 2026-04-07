'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient, type ApiError, type ApiResponse, type RequestConfig } from '@/lib/api-client'
import { queryCache } from './use-query'

// ============================================================================
// Types
// ============================================================================

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface UseMutationOptions<TData, TVariables, TContext = unknown> {
  /** HTTP method to use (defaults to POST) */
  method?: MutationMethod
  /** Additional request configuration */
  config?: Omit<RequestConfig, 'body'>
  /** Called before the mutation function is fired */
  onMutate?: (variables: TVariables) => Promise<TContext | void> | TContext | void
  /** Called when mutation succeeds */
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void
  /** Called when mutation fails */
  onError?: (
    error: ApiError,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void
  /** Called when mutation settles (success or error) */
  onSettled?: (
    data: TData | undefined,
    error: ApiError | null,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void
  /** Query keys to invalidate on success */
  invalidateQueries?: string | string[]
  /** Whether to retry failed mutations */
  retry?: boolean | number
  /** Delay between retries in milliseconds */
  retryDelay?: number
}

export interface MutationState<TData> {
  data: TData | undefined
  error: ApiError | null
  status: 'idle' | 'pending' | 'success' | 'error'
}

export interface UseMutationResult<TData, TVariables> {
  /** The data returned from the mutation */
  data: TData | undefined
  /** Error from the mutation */
  error: ApiError | null
  /** True if the mutation is currently executing */
  isPending: boolean
  /** True if the mutation was successful */
  isSuccess: boolean
  /** True if the mutation failed */
  isError: boolean
  /** True if the mutation hasn't been triggered yet */
  isIdle: boolean
  /** Current status of the mutation */
  status: 'idle' | 'pending' | 'success' | 'error'
  /** Function to trigger the mutation */
  mutate: (variables: TVariables) => void
  /** Function to trigger the mutation and return a promise */
  mutateAsync: (variables: TVariables) => Promise<TData>
  /** Reset the mutation state to idle */
  reset: () => void
}

// ============================================================================
// URL Mutation Hook (for API endpoints)
// ============================================================================

/**
 * Hook for mutations to a URL endpoint
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useMutation<User, CreateUserInput>(
 *   '/api/users',
 *   {
 *     method: 'POST',
 *     onSuccess: (user) => {
 *       toast.success(`User ${user.name} created!`)
 *     },
 *     invalidateQueries: ['users']
 *   }
 * )
 *
 * // Trigger the mutation
 * mutate({ name: 'John', email: 'john@example.com' })
 * ```
 */
export function useMutation<TData, TVariables = void, TContext = unknown>(
  url: string,
  options: UseMutationOptions<TData, TVariables, TContext> = {}
): UseMutationResult<TData, TVariables> {
  const {
    method = 'POST',
    config = {},
    onMutate,
    onSuccess,
    onError,
    onSettled,
    invalidateQueries,
    retry = false,
    retryDelay = 1000,
  } = options

  const [state, setState] = useState<MutationState<TData>>({
    data: undefined,
    error: null,
    status: 'idle',
  })

  const isMountedRef = useRef(true)
  const mutationIdRef = useRef(0)

  // Reset function
  const reset = useCallback(() => {
    setState({
      data: undefined,
      error: null,
      status: 'idle',
    })
  }, [])

  // Core mutation function
  const executeMutation = useCallback(
    async (variables: TVariables): Promise<TData> => {
      const currentMutationId = ++mutationIdRef.current
      let context: TContext | undefined

      try {
        // Call onMutate for optimistic updates
        context = (await onMutate?.(variables)) as TContext | undefined

        setState({
          data: undefined,
          error: null,
          status: 'pending',
        })

        // Determine retry count
        const maxRetries = typeof retry === 'number' ? retry : retry ? 3 : 0
        let lastError: ApiError | null = null

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            let response: ApiResponse<TData>

            switch (method) {
              case 'POST':
                response = await apiClient.post<TData, TVariables>(url, variables, config)
                break
              case 'PUT':
                response = await apiClient.put<TData, TVariables>(url, variables, config)
                break
              case 'PATCH':
                response = await apiClient.patch<TData, TVariables>(url, variables, config)
                break
              case 'DELETE':
                response = await apiClient.delete<TData>(url, config)
                break
              default:
                throw new Error(`Unsupported method: ${method}`)
            }

            // Check if this mutation is still relevant
            if (currentMutationId !== mutationIdRef.current || !isMountedRef.current) {
              return response.data
            }

            // Update state on success
            setState({
              data: response.data,
              error: null,
              status: 'success',
            })

            // Invalidate queries
            if (invalidateQueries) {
              const keys = Array.isArray(invalidateQueries)
                ? invalidateQueries
                : [invalidateQueries]
              keys.forEach((key) => queryCache.invalidate(key))
            }

            // Call success callback
            await onSuccess?.(response.data, variables, context)
            await onSettled?.(response.data, null, variables, context)

            return response.data
          } catch (error) {
            lastError = error as ApiError

            // Only retry if it's a retryable error
            if (attempt < maxRetries && lastError.retryable) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * Math.pow(2, attempt))
              )
              continue
            }

            throw lastError
          }
        }

        // This shouldn't be reached, but TypeScript needs it
        throw lastError ?? new Error('Mutation failed')
      } catch (error) {
        const apiError = error as ApiError

        // Check if this mutation is still relevant
        if (currentMutationId !== mutationIdRef.current || !isMountedRef.current) {
          throw apiError
        }

        // Update state on error
        setState((prev) => ({
          ...prev,
          error: apiError,
          status: 'error',
        }))

        // Call error callback
        await onError?.(apiError, variables, context)
        await onSettled?.(undefined, apiError, variables, context)

        throw apiError
      }
    },
    [
      url,
      method,
      config,
      onMutate,
      onSuccess,
      onError,
      onSettled,
      invalidateQueries,
      retry,
      retryDelay,
    ]
  )

  // Sync mutate (doesn't return promise, handles errors internally)
  const mutate = useCallback(
    (variables: TVariables) => {
      executeMutation(variables).catch(() => {
        // Error is already handled in executeMutation
      })
    },
    [executeMutation]
  )

  // Async mutate (returns promise)
  const mutateAsync = useCallback(
    (variables: TVariables): Promise<TData> => {
      return executeMutation(variables)
    },
    [executeMutation]
  )

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    data: state.data,
    error: state.error,
    isPending: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isIdle: state.status === 'idle',
    status: state.status,
    mutate,
    mutateAsync,
    reset,
  }
}

// ============================================================================
// Custom Mutator Hook (for custom mutation functions)
// ============================================================================

/**
 * Hook for custom mutation functions (not tied to a URL)
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useCustomMutation<User, CreateUserInput>(
 *   async (input) => {
 *     const result = await someCustomApi.createUser(input)
 *     return result
 *   },
 *   {
 *     onSuccess: (user) => {
 *       toast.success(`User ${user.name} created!`)
 *     }
 *   }
 * )
 * ```
 */
export function useCustomMutation<TData, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: Omit<UseMutationOptions<TData, TVariables, TContext>, 'method' | 'config'> = {}
): UseMutationResult<TData, TVariables> {
  const {
    onMutate,
    onSuccess,
    onError,
    onSettled,
    invalidateQueries,
    retry = false,
    retryDelay = 1000,
  } = options

  const [state, setState] = useState<MutationState<TData>>({
    data: undefined,
    error: null,
    status: 'idle',
  })

  const isMountedRef = useRef(true)
  const mutationIdRef = useRef(0)

  const reset = useCallback(() => {
    setState({
      data: undefined,
      error: null,
      status: 'idle',
    })
  }, [])

  const executeMutation = useCallback(
    async (variables: TVariables): Promise<TData> => {
      const currentMutationId = ++mutationIdRef.current
      let context: TContext | undefined

      try {
        context = (await onMutate?.(variables)) as TContext | undefined

        setState({
          data: undefined,
          error: null,
          status: 'pending',
        })

        const maxRetries = typeof retry === 'number' ? retry : retry ? 3 : 0
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const data = await mutationFn(variables)

            if (currentMutationId !== mutationIdRef.current || !isMountedRef.current) {
              return data
            }

            setState({
              data,
              error: null,
              status: 'success',
            })

            if (invalidateQueries) {
              const keys = Array.isArray(invalidateQueries)
                ? invalidateQueries
                : [invalidateQueries]
              keys.forEach((key) => queryCache.invalidate(key))
            }

            await onSuccess?.(data, variables, context)
            await onSettled?.(data, null, variables, context)

            return data
          } catch (error) {
            lastError = error as Error

            if (attempt < maxRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * Math.pow(2, attempt))
              )
              continue
            }

            throw lastError
          }
        }

        throw lastError ?? new Error('Mutation failed')
      } catch (error) {
        const apiError = error as ApiError

        if (currentMutationId !== mutationIdRef.current || !isMountedRef.current) {
          throw apiError
        }

        setState((prev) => ({
          ...prev,
          error: apiError,
          status: 'error',
        }))

        await onError?.(apiError, variables, context)
        await onSettled?.(undefined, apiError, variables, context)

        throw apiError
      }
    },
    [mutationFn, onMutate, onSuccess, onError, onSettled, invalidateQueries, retry, retryDelay]
  )

  const mutate = useCallback(
    (variables: TVariables) => {
      executeMutation(variables).catch(() => {})
    },
    [executeMutation]
  )

  const mutateAsync = useCallback(
    (variables: TVariables): Promise<TData> => {
      return executeMutation(variables)
    },
    [executeMutation]
  )

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    data: state.data,
    error: state.error,
    isPending: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isIdle: state.status === 'idle',
    status: state.status,
    mutate,
    mutateAsync,
    reset,
  }
}

// ============================================================================
// Optimistic Update Helpers
// ============================================================================

/**
 * Helper for optimistic updates with automatic rollback
 *
 * @example
 * ```tsx
 * const { mutate } = useMutation<Todo, UpdateTodoInput, OptimisticContext<Todo[]>>(
 *   '/api/todos/update',
 *   {
 *     onMutate: async (input) => {
 *       return optimisticUpdate('todos', (todos) =>
 *         todos.map(t => t.id === input.id ? { ...t, ...input } : t)
 *       )
 *     },
 *     onError: (error, variables, context) => {
 *       if (context) rollbackOptimisticUpdate('todos', context)
 *     }
 *   }
 * )
 * ```
 */
export interface OptimisticContext<TData> {
  previousData: TData | undefined
}

export function optimisticUpdate<TData>(
  queryKey: string,
  updater: (currentData: TData) => TData
): OptimisticContext<TData> {
  const cached = queryCache.get<TData>(queryKey)
  const previousData = cached?.data

  if (previousData !== undefined) {
    const newData = updater(previousData)
    queryCache.set(queryKey, newData, Date.now())
  }

  return { previousData }
}

export function rollbackOptimisticUpdate<TData>(
  queryKey: string,
  context: OptimisticContext<TData>
): void {
  if (context.previousData !== undefined) {
    queryCache.set(queryKey, context.previousData, Date.now())
  }
}

// ============================================================================
// Batch Mutations
// ============================================================================

export interface BatchMutationResult<TData> {
  results: Array<{ data?: TData; error?: ApiError }>
  successCount: number
  errorCount: number
  hasErrors: boolean
}

/**
 * Execute multiple mutations in parallel or sequence
 *
 * @example
 * ```tsx
 * const results = await batchMutate(
 *   items.map(item => ({
 *     url: '/api/items',
 *     method: 'POST',
 *     body: item
 *   })),
 *   { parallel: true }
 * )
 * ```
 */
export async function batchMutate<TData, TBody = unknown>(
  mutations: Array<{
    url: string
    method?: MutationMethod
    body?: TBody
    config?: RequestConfig
  }>,
  options: {
    parallel?: boolean
    stopOnError?: boolean
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<BatchMutationResult<TData>> {
  const { parallel = false, stopOnError = false, onProgress } = options

  const results: Array<{ data?: TData; error?: ApiError }> = []
  let successCount = 0
  let errorCount = 0

  const executeSingle = async (
    mutation: (typeof mutations)[0],
    index: number
  ): Promise<void> => {
    try {
      const method = mutation.method ?? 'POST'
      let response: ApiResponse<TData>

      switch (method) {
        case 'POST':
          response = await apiClient.post<TData, TBody>(
            mutation.url,
            mutation.body,
            mutation.config as any
          )
          break
        case 'PUT':
          response = await apiClient.put<TData, TBody>(
            mutation.url,
            mutation.body,
            mutation.config as any
          )
          break
        case 'PATCH':
          response = await apiClient.patch<TData, TBody>(
            mutation.url,
            mutation.body,
            mutation.config as any
          )
          break
        case 'DELETE':
          response = await apiClient.delete<TData>(mutation.url, mutation.config as any)
          break
      }

      results[index] = { data: response.data }
      successCount++
    } catch (error) {
      results[index] = { error: error as ApiError }
      errorCount++

      if (stopOnError) {
        throw error
      }
    }

    onProgress?.(successCount + errorCount, mutations.length)
  }

  if (parallel) {
    await Promise.allSettled(
      mutations.map((mutation, index) => executeSingle(mutation, index))
    )
  } else {
    for (let i = 0; i < mutations.length; i++) {
      try {
        await executeSingle(mutations[i], i)
      } catch {
        if (stopOnError) break
      }
    }
  }

  return {
    results,
    successCount,
    errorCount,
    hasErrors: errorCount > 0,
  }
}

// ============================================================================
// Form Mutation Hook
// ============================================================================

export interface UseFormMutationOptions<TData, TVariables, TContext = unknown>
  extends UseMutationOptions<TData, TVariables, TContext> {
  /** Transform form data before sending */
  transformInput?: (formData: TVariables) => unknown
  /** Reset form on success */
  resetOnSuccess?: boolean
}

/**
 * Specialized mutation hook for form submissions
 *
 * @example
 * ```tsx
 * const { mutate, isPending, fieldErrors } = useFormMutation<User, UserFormData>(
 *   '/api/users',
 *   {
 *     method: 'POST',
 *     onSuccess: () => router.push('/users'),
 *   }
 * )
 *
 * // In form
 * <form onSubmit={handleSubmit(mutate)}>
 *   {fieldErrors?.email && <span>{fieldErrors.email}</span>}
 * </form>
 * ```
 */
export interface UseFormMutationResult<TData, TVariables>
  extends UseMutationResult<TData, TVariables> {
  /** Field-level errors from validation */
  fieldErrors: Record<string, string> | null
  /** General form error message */
  formError: string | null
}

export function useFormMutation<TData, TVariables = Record<string, unknown>, TContext = unknown>(
  url: string,
  options: UseFormMutationOptions<TData, TVariables, TContext> = {}
): UseFormMutationResult<TData, TVariables> {
  const { transformInput, resetOnSuccess = false, ...mutationOptions } = options

  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation<TData, TVariables, TContext>(url, {
    ...mutationOptions,
    config: {
      ...mutationOptions.config,
      headers: {
        ...mutationOptions.config?.headers,
      },
    },
    onMutate: async (variables) => {
      setFieldErrors(null)
      setFormError(null)
      return mutationOptions.onMutate?.(variables)
    },
    onError: async (error, variables, context) => {
      // Try to extract field errors from the error response
      if (error.data && typeof error.data === 'object') {
        const errorData = error.data as Record<string, unknown>

        if (errorData.errors && typeof errorData.errors === 'object') {
          setFieldErrors(errorData.errors as Record<string, string>)
        } else if (errorData.message && typeof errorData.message === 'string') {
          setFormError(errorData.message)
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError(error.message)
      }

      return mutationOptions.onError?.(error, variables, context)
    },
    onSuccess: async (data, variables, context) => {
      if (resetOnSuccess) {
        setFieldErrors(null)
        setFormError(null)
      }
      return mutationOptions.onSuccess?.(data, variables, context)
    },
  })

  const reset = useCallback(() => {
    mutation.reset()
    setFieldErrors(null)
    setFormError(null)
  }, [mutation])

  return {
    ...mutation,
    reset,
    fieldErrors,
    formError,
  }
}
