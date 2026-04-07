'use client'

import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'outline'
}

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  dismissable?: boolean
  action?: ToastAction
  onDismiss?: () => void
}

export interface ToastOptions {
  type?: ToastType
  title: string
  description?: string
  duration?: number
  dismissable?: boolean
  action?: ToastAction
  onDismiss?: () => void
}

interface ToastState {
  toasts: Toast[]
  addToast: (options: ToastOptions) => string
  removeToast: (id: string) => void
  clearAllToasts: () => void
  updateToast: (id: string, options: Partial<ToastOptions>) => void
}

// Generate unique ID
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Default durations per toast type (in milliseconds)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
}

// Maximum number of toasts to show at once
const MAX_TOASTS = 5

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (options: ToastOptions) => {
    const id = generateId()
    const type = options.type || 'info'
    const duration = options.duration ?? DEFAULT_DURATIONS[type]
    const dismissable = options.dismissable ?? true

    const newToast: Toast = {
      id,
      type,
      title: options.title,
      description: options.description,
      duration,
      dismissable,
      action: options.action,
      onDismiss: options.onDismiss,
    }

    set((state) => {
      // Remove oldest toasts if we exceed maximum
      let toasts = [...state.toasts, newToast]
      if (toasts.length > MAX_TOASTS) {
        toasts = toasts.slice(-MAX_TOASTS)
      }
      return { toasts }
    })

    // Auto-dismiss after duration (if not 0 or Infinity)
    if (duration && duration !== Infinity && duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }

    return id
  },

  removeToast: (id: string) => {
    const toast = get().toasts.find((t) => t.id === id)
    if (toast?.onDismiss) {
      toast.onDismiss()
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearAllToasts: () => {
    const toasts = get().toasts
    toasts.forEach((toast) => {
      if (toast.onDismiss) {
        toast.onDismiss()
      }
    })
    set({ toasts: [] })
  },

  updateToast: (id: string, options: Partial<ToastOptions>) => {
    set((state) => ({
      toasts: state.toasts.map((toast) =>
        toast.id === id ? { ...toast, ...options } : toast
      ),
    }))
  },
}))

// Convenience hook that returns helper methods
export function useToast() {
  const store = useToastStore()

  const toast = (options: ToastOptions) => store.addToast(options)

  const success = (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    store.addToast({ ...options, title, type: 'success' })

  const error = (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    store.addToast({ ...options, title, type: 'error' })

  const warning = (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    store.addToast({ ...options, title, type: 'warning' })

  const info = (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    store.addToast({ ...options, title, type: 'info' })

  const dismiss = (id: string) => store.removeToast(id)

  const dismissAll = () => store.clearAllToasts()

  const update = (id: string, options: Partial<ToastOptions>) =>
    store.updateToast(id, options)

  // Promise-based toast for async operations
  const promise = async <T,>(
    promiseFn: Promise<T>,
    options: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: unknown) => string)
    }
  ): Promise<T> => {
    const id = store.addToast({
      title: options.loading,
      type: 'info',
      duration: Infinity,
      dismissable: false,
    })

    try {
      const result = await promiseFn
      store.updateToast(id, {
        title: typeof options.success === 'function' ? options.success(result) : options.success,
        type: 'success',
        duration: DEFAULT_DURATIONS.success,
        dismissable: true,
      })

      // Auto-dismiss after success duration
      setTimeout(() => {
        store.removeToast(id)
      }, DEFAULT_DURATIONS.success)

      return result
    } catch (err) {
      store.updateToast(id, {
        title: typeof options.error === 'function' ? options.error(err) : options.error,
        type: 'error',
        duration: DEFAULT_DURATIONS.error,
        dismissable: true,
      })

      // Auto-dismiss after error duration
      setTimeout(() => {
        store.removeToast(id)
      }, DEFAULT_DURATIONS.error)

      throw err
    }
  }

  return {
    toasts: store.toasts,
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    update,
    promise,
  }
}

// Export a standalone toast function for use outside React components
export const toast = {
  show: (options: ToastOptions) => useToastStore.getState().addToast(options),
  success: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    useToastStore.getState().addToast({ ...options, title, type: 'success' }),
  error: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    useToastStore.getState().addToast({ ...options, title, type: 'error' }),
  warning: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    useToastStore.getState().addToast({ ...options, title, type: 'warning' }),
  info: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
    useToastStore.getState().addToast({ ...options, title, type: 'info' }),
  dismiss: (id: string) => useToastStore.getState().removeToast(id),
  dismissAll: () => useToastStore.getState().clearAllToasts(),
}
