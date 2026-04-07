// Authentication
export { useAuth } from './use-auth'

// Data Fetching
export {
  useQuery,
  useFetch,
  usePaginatedQuery,
  useInfiniteQuery,
  queryCache,
  type UseQueryOptions,
  type UseQueryResult,
  type UsePaginatedQueryOptions,
  type UsePaginatedQueryResult,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
} from './use-query'

// Mutations
export {
  useMutation,
  useCustomMutation,
  useFormMutation,
  batchMutate,
  optimisticUpdate,
  rollbackOptimisticUpdate,
  type UseMutationOptions,
  type UseMutationResult,
  type UseFormMutationOptions,
  type UseFormMutationResult,
  type MutationMethod,
  type MutationState,
  type BatchMutationResult,
  type OptimisticContext,
} from './use-mutation'
