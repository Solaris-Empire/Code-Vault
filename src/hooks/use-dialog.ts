'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { create } from 'zustand'

// ============================================================================
// Simple Dialog Hook - For individual dialog state management
// ============================================================================

export interface UseDialogReturn<T = undefined> {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Data passed to the dialog */
  data: T | undefined
  /** Open the dialog with optional data */
  open: (data?: T) => void
  /** Close the dialog */
  close: () => void
  /** Toggle the dialog open/close state */
  toggle: () => void
  /** Set the open state directly */
  setOpen: (open: boolean) => void
  /** Props to spread onto a Dialog component */
  dialogProps: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
}

/**
 * Hook for managing dialog state with optional data
 *
 * @example
 * // Basic usage
 * const dialog = useDialog()
 * <Dialog {...dialog.dialogProps}>...</Dialog>
 *
 * @example
 * // With data
 * const editDialog = useDialog<Product>()
 * editDialog.open(product)
 * // Access data: editDialog.data
 */
export function useDialog<T = undefined>(
  initialOpen = false
): UseDialogReturn<T> {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [data, setData] = useState<T | undefined>(undefined)

  const open = useCallback((newData?: T) => {
    setData(newData)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Clear data after animation completes
    setTimeout(() => setData(undefined), 300)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      close()
    } else {
      setIsOpen(true)
    }
  }, [close])

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setOpen: setIsOpen,
    dialogProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
    },
  }
}

// ============================================================================
// Confirmation Dialog Hook - For async confirmations
// ============================================================================

export interface UseConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info'
}

export interface UseConfirmReturn {
  /** Whether the confirm dialog is open */
  isOpen: boolean
  /** Current confirmation options */
  options: UseConfirmOptions | null
  /** Show confirmation and wait for user response */
  confirm: (options: UseConfirmOptions) => Promise<boolean>
  /** Handle user confirming */
  handleConfirm: () => void
  /** Handle user canceling */
  handleCancel: () => void
  /** Close the dialog programmatically */
  close: () => void
  /** Props for the ConfirmDialog component */
  dialogProps: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info'
    onConfirm: () => void
    onCancel: () => void
  }
}

/**
 * Hook for async confirmation dialogs
 *
 * @example
 * const confirm = useConfirm()
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm.confirm({
 *     title: 'Delete item?',
 *     description: 'This action cannot be undone.',
 *     variant: 'destructive',
 *   })
 *
 *   if (confirmed) {
 *     // Proceed with deletion
 *   }
 * }
 *
 * <ConfirmDialog {...confirm.dialogProps} />
 */
export function useConfirm(): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<UseConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: UseConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setIsOpen(true)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true)
    resolveRef.current = null
    setIsOpen(false)
    setTimeout(() => setOptions(null), 300)
  }, [])

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false)
    resolveRef.current = null
    setIsOpen(false)
    setTimeout(() => setOptions(null), 300)
  }, [])

  const close = useCallback(() => {
    handleCancel()
  }, [handleCancel])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      handleCancel()
    }
  }, [handleCancel])

  return {
    isOpen,
    options,
    confirm,
    handleConfirm,
    handleCancel,
    close,
    dialogProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
      title: options?.title ?? '',
      description: options?.description,
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel,
      variant: options?.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  }
}

// ============================================================================
// Dialog Stack - For managing multiple dialogs globally
// ============================================================================

export interface DialogStackItem {
  id: string
  component: React.ComponentType<{ onClose: () => void; data?: unknown }>
  data?: unknown
  options?: {
    closeOnOverlayClick?: boolean
    closeOnEscape?: boolean
  }
}

interface DialogStackState {
  dialogs: DialogStackItem[]
  push: <T = unknown>(
    id: string,
    component: React.ComponentType<{ onClose: () => void; data?: T }>,
    data?: T,
    options?: DialogStackItem['options']
  ) => void
  pop: () => void
  close: (id: string) => void
  closeAll: () => void
  isOpen: (id: string) => boolean
  getDialog: (id: string) => DialogStackItem | undefined
}

/**
 * Global dialog stack store for managing multiple stacked dialogs
 *
 * @example
 * // Push a dialog onto the stack
 * useDialogStack.getState().push('edit-product', EditProductDialog, product)
 *
 * // Close the top dialog
 * useDialogStack.getState().pop()
 *
 * // Close a specific dialog
 * useDialogStack.getState().close('edit-product')
 */
export const useDialogStack = create<DialogStackState>((set, get) => ({
  dialogs: [],

  push: (id, component, data, options) => {
    set((state) => ({
      dialogs: [
        ...state.dialogs.filter((d) => d.id !== id),
        { id, component: component as DialogStackItem['component'], data, options },
      ],
    }))
  },

  pop: () => {
    set((state) => ({
      dialogs: state.dialogs.slice(0, -1),
    }))
  },

  close: (id) => {
    set((state) => ({
      dialogs: state.dialogs.filter((d) => d.id !== id),
    }))
  },

  closeAll: () => {
    set({ dialogs: [] })
  },

  isOpen: (id) => {
    return get().dialogs.some((d) => d.id === id)
  },

  getDialog: (id) => {
    return get().dialogs.find((d) => d.id === id)
  },
}))

// ============================================================================
// Alert/Prompt/Confirm Global API - Browser-like dialogs
// ============================================================================

interface GlobalDialogState {
  // Alert state
  alertOpen: boolean
  alertOptions: {
    title: string
    message?: string
    buttonLabel?: string
  } | null
  alertResolve: (() => void) | null

  // Confirm state
  confirmOpen: boolean
  confirmOptions: UseConfirmOptions | null
  confirmResolve: ((value: boolean) => void) | null

  // Prompt state
  promptOpen: boolean
  promptOptions: {
    title: string
    message?: string
    defaultValue?: string
    placeholder?: string
    confirmLabel?: string
    cancelLabel?: string
  } | null
  promptResolve: ((value: string | null) => void) | null

  // Actions
  showAlert: (title: string, message?: string, buttonLabel?: string) => Promise<void>
  showConfirm: (options: UseConfirmOptions) => Promise<boolean>
  showPrompt: (options: {
    title: string
    message?: string
    defaultValue?: string
    placeholder?: string
    confirmLabel?: string
    cancelLabel?: string
  }) => Promise<string | null>

  // Internal handlers
  resolveAlert: () => void
  resolveConfirm: (value: boolean) => void
  resolvePrompt: (value: string | null) => void
}

/**
 * Global dialog store for browser-like alert/confirm/prompt dialogs
 *
 * @example
 * // Simple alert
 * await globalDialog.getState().showAlert('Success', 'Item saved successfully')
 *
 * // Confirmation
 * const confirmed = await globalDialog.getState().showConfirm({
 *   title: 'Delete item?',
 *   description: 'This cannot be undone.',
 *   variant: 'destructive',
 * })
 *
 * // Prompt for input
 * const name = await globalDialog.getState().showPrompt({
 *   title: 'Rename item',
 *   defaultValue: currentName,
 * })
 */
export const globalDialog = create<GlobalDialogState>((set, get) => ({
  // Alert state
  alertOpen: false,
  alertOptions: null,
  alertResolve: null,

  // Confirm state
  confirmOpen: false,
  confirmOptions: null,
  confirmResolve: null,

  // Prompt state
  promptOpen: false,
  promptOptions: null,
  promptResolve: null,

  // Show alert
  showAlert: (title, message, buttonLabel = 'OK') => {
    return new Promise<void>((resolve) => {
      set({
        alertOpen: true,
        alertOptions: { title, message, buttonLabel },
        alertResolve: resolve,
      })
    })
  },

  // Show confirm
  showConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmOpen: true,
        confirmOptions: options,
        confirmResolve: resolve,
      })
    })
  },

  // Show prompt
  showPrompt: (options) => {
    return new Promise<string | null>((resolve) => {
      set({
        promptOpen: true,
        promptOptions: options,
        promptResolve: resolve,
      })
    })
  },

  // Resolve handlers
  resolveAlert: () => {
    const { alertResolve } = get()
    alertResolve?.()
    set({
      alertOpen: false,
      alertOptions: null,
      alertResolve: null,
    })
  },

  resolveConfirm: (value) => {
    const { confirmResolve } = get()
    confirmResolve?.(value)
    set({
      confirmOpen: false,
      confirmOptions: null,
      confirmResolve: null,
    })
  },

  resolvePrompt: (value) => {
    const { promptResolve } = get()
    promptResolve?.(value)
    set({
      promptOpen: false,
      promptOptions: null,
      promptResolve: null,
    })
  },
}))

// ============================================================================
// Convenient helper functions
// ============================================================================

/**
 * Show an alert dialog (similar to window.alert)
 */
export const showAlert = globalDialog.getState().showAlert

/**
 * Show a confirmation dialog (similar to window.confirm)
 */
export const showConfirm = globalDialog.getState().showConfirm

/**
 * Show a prompt dialog (similar to window.prompt)
 */
export const showPrompt = globalDialog.getState().showPrompt

// ============================================================================
// Focus management hook
// ============================================================================

/**
 * Hook for managing focus when dialog opens/closes
 * Automatically returns focus to the trigger element
 */
export function useDialogFocus(isOpen: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const previousActiveElement = useRef<Element | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
    } else if (previousActiveElement.current) {
      // Return focus to the previous element when dialog closes
      (previousActiveElement.current as HTMLElement)?.focus?.()
      previousActiveElement.current = null
    }
  }, [isOpen])

  const setTriggerRef = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element
  }, [])

  return { triggerRef, setTriggerRef }
}

// ============================================================================
// Escape key handler hook
// ============================================================================

/**
 * Hook for handling escape key press
 */
export function useEscapeKey(
  callback: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [callback, enabled])
}

// ============================================================================
// Click outside handler hook
// ============================================================================

/**
 * Hook for handling clicks outside a referenced element
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }

    // Use mousedown to catch the click before it potentially triggers other handlers
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ref, callback, enabled])
}

// ============================================================================
// Body scroll lock hook
// ============================================================================

/**
 * Hook for preventing body scroll when dialog is open
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return

    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [isOpen])
}
