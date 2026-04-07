'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export interface UsePaginationOptions {
  /** Total number of items */
  totalItems: number
  /** Number of items per page */
  pageSize?: number
  /** Current page (1-indexed) */
  currentPage?: number
  /** Number of sibling pages to show on each side of current page */
  siblingCount?: number
  /** URL parameter name for the page */
  pageParam?: string
  /** Whether to update the URL when page changes */
  updateUrl?: boolean
  /** Callback when page changes */
  onPageChange?: (page: number) => void
}

export interface UsePaginationReturn {
  /** Current page (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Total number of items */
  totalItems: number
  /** Number of items per page */
  pageSize: number
  /** Whether there is a previous page */
  hasPreviousPage: boolean
  /** Whether there is a next page */
  hasNextPage: boolean
  /** Whether the current page is the first page */
  isFirstPage: boolean
  /** Whether the current page is the last page */
  isLastPage: boolean
  /** Index of the first item on the current page (0-indexed) */
  startIndex: number
  /** Index of the last item on the current page (0-indexed) */
  endIndex: number
  /** Array of page numbers/ellipsis to display */
  pageRange: (number | 'ellipsis')[]
  /** Go to a specific page */
  goToPage: (page: number) => void
  /** Go to the next page */
  goToNextPage: () => void
  /** Go to the previous page */
  goToPreviousPage: () => void
  /** Go to the first page */
  goToFirstPage: () => void
  /** Go to the last page */
  goToLastPage: () => void
}

const ELLIPSIS = 'ellipsis' as const

/**
 * Generate an array of numbers from start to end (inclusive)
 */
function range(start: number, end: number): number[] {
  const length = end - start + 1
  return Array.from({ length }, (_, idx) => idx + start)
}

/**
 * Calculate the page range to display, including ellipsis
 */
function calculatePageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): (number | 'ellipsis')[] {
  // Total number of page numbers to show (including current)
  // Format: first + dots + siblings + current + siblings + dots + last
  const totalPageNumbers = siblingCount * 2 + 5

  // If total pages is less than what we want to show, display all pages
  if (totalPages <= totalPageNumbers) {
    return range(1, totalPages)
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

  const shouldShowLeftDots = leftSiblingIndex > 2
  const shouldShowRightDots = rightSiblingIndex < totalPages - 1

  const firstPageIndex = 1
  const lastPageIndex = totalPages

  // No left dots, but right dots
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount
    const leftRange = range(1, leftItemCount)
    return [...leftRange, ELLIPSIS, totalPages]
  }

  // Left dots, no right dots
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount
    const rightRange = range(totalPages - rightItemCount + 1, totalPages)
    return [firstPageIndex, ELLIPSIS, ...rightRange]
  }

  // Both left and right dots
  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = range(leftSiblingIndex, rightSiblingIndex)
    return [firstPageIndex, ELLIPSIS, ...middleRange, ELLIPSIS, lastPageIndex]
  }

  return range(1, totalPages)
}

export function usePagination({
  totalItems,
  pageSize = 10,
  currentPage: controlledPage,
  siblingCount = 1,
  pageParam = 'page',
  updateUrl = true,
  onPageChange,
}: UsePaginationOptions): UsePaginationReturn {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get current page from URL or use controlled value
  const pageFromUrl = searchParams.get(pageParam)
  const currentPage = useMemo(() => {
    if (controlledPage !== undefined) {
      return Math.max(1, controlledPage)
    }
    const parsed = parseInt(pageFromUrl || '1', 10)
    return isNaN(parsed) || parsed < 1 ? 1 : parsed
  }, [controlledPage, pageFromUrl])

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize))
  }, [totalItems, pageSize])

  // Ensure current page doesn't exceed total pages
  const validCurrentPage = useMemo(() => {
    return Math.min(currentPage, totalPages)
  }, [currentPage, totalPages])

  // Calculate page range
  const pageRange = useMemo(() => {
    return calculatePageRange(validCurrentPage, totalPages, siblingCount)
  }, [validCurrentPage, totalPages, siblingCount])

  // Calculate start and end indices
  const startIndex = useMemo(() => {
    return (validCurrentPage - 1) * pageSize
  }, [validCurrentPage, pageSize])

  const endIndex = useMemo(() => {
    return Math.min(startIndex + pageSize - 1, totalItems - 1)
  }, [startIndex, pageSize, totalItems])

  // Navigation helper
  const updatePage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, Math.min(page, totalPages))

      if (onPageChange) {
        onPageChange(newPage)
      }

      if (updateUrl) {
        const params = new URLSearchParams(searchParams.toString())
        if (newPage === 1) {
          params.delete(pageParam)
        } else {
          params.set(pageParam, String(newPage))
        }
        const query = params.toString()
        router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
      }
    },
    [totalPages, onPageChange, updateUrl, searchParams, pageParam, router, pathname]
  )

  const goToPage = useCallback(
    (page: number) => {
      updatePage(page)
    },
    [updatePage]
  )

  const goToNextPage = useCallback(() => {
    if (validCurrentPage < totalPages) {
      updatePage(validCurrentPage + 1)
    }
  }, [validCurrentPage, totalPages, updatePage])

  const goToPreviousPage = useCallback(() => {
    if (validCurrentPage > 1) {
      updatePage(validCurrentPage - 1)
    }
  }, [validCurrentPage, updatePage])

  const goToFirstPage = useCallback(() => {
    updatePage(1)
  }, [updatePage])

  const goToLastPage = useCallback(() => {
    updatePage(totalPages)
  }, [totalPages, updatePage])

  return {
    currentPage: validCurrentPage,
    totalPages,
    totalItems,
    pageSize,
    hasPreviousPage: validCurrentPage > 1,
    hasNextPage: validCurrentPage < totalPages,
    isFirstPage: validCurrentPage === 1,
    isLastPage: validCurrentPage === totalPages,
    startIndex,
    endIndex: totalItems > 0 ? endIndex : -1,
    pageRange,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  }
}

/**
 * Calculate page range without hooks (for server-side rendering or static use)
 */
export function getPageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number = 1
): (number | 'ellipsis')[] {
  return calculatePageRange(currentPage, totalPages, siblingCount)
}

/**
 * Calculate pagination metadata without hooks
 */
export function getPaginationMeta(
  totalItems: number,
  pageSize: number,
  currentPage: number
) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages))
  const startIndex = (validCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1)

  return {
    currentPage: validCurrentPage,
    totalPages,
    totalItems,
    pageSize,
    hasPreviousPage: validCurrentPage > 1,
    hasNextPage: validCurrentPage < totalPages,
    isFirstPage: validCurrentPage === 1,
    isLastPage: validCurrentPage === totalPages,
    startIndex,
    endIndex: totalItems > 0 ? endIndex : -1,
  }
}
