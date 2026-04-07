'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ============================================================================
// Types
// ============================================================================

/**
 * Validation rule that can be synchronous or asynchronous
 */
export type ValidationRule<T, K extends keyof T> = (
  value: T[K],
  values: T
) => string | undefined | Promise<string | undefined>

/**
 * Validation schema - maps field names to arrays of validation rules
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T, K>[]
}

/**
 * Field-level errors
 */
export type FormErrors<T> = {
  [K in keyof T]?: string
}

/**
 * Track which fields have been modified
 */
export type DirtyFields<T> = {
  [K in keyof T]?: boolean
}

/**
 * Track which fields have been interacted with (blurred)
 */
export type TouchedFields<T> = {
  [K in keyof T]?: boolean
}

/**
 * Form state containing all tracking information
 */
export interface FormState<T> {
  values: T
  errors: FormErrors<T>
  touched: TouchedFields<T>
  dirty: DirtyFields<T>
  isSubmitting: boolean
  isValidating: boolean
  isValid: boolean
  isDirty: boolean
  submitCount: number
}

/**
 * Options for configuring the form hook
 */
export interface UseFormOptions<T> {
  initialValues: T
  validationSchema?: ValidationSchema<T>
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateOnMount?: boolean
  onSubmit?: (values: T) => void | Promise<void>
}

/**
 * Field registration props for binding to inputs
 */
export interface FieldProps<T, K extends keyof T> {
  name: K
  value: T[K]
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Field metadata for accessing field state
 */
export interface FieldMeta<T, K extends keyof T> {
  error?: string
  touched: boolean
  dirty: boolean
  value: T[K]
}

/**
 * Return type of the useForm hook
 */
export interface UseFormReturn<T> {
  // State
  values: T
  errors: FormErrors<T>
  touched: TouchedFields<T>
  dirty: DirtyFields<T>
  isSubmitting: boolean
  isValidating: boolean
  isValid: boolean
  isDirty: boolean
  submitCount: number

  // Field helpers
  register: <K extends keyof T>(name: K) => FieldProps<T, K>
  getFieldMeta: <K extends keyof T>(name: K) => FieldMeta<T, K>
  getFieldError: <K extends keyof T>(name: K) => string | undefined

  // Value setters
  setValue: <K extends keyof T>(name: K, value: T[K], options?: { shouldValidate?: boolean; shouldDirty?: boolean; shouldTouch?: boolean }) => void
  setValues: (values: Partial<T>, options?: { shouldValidate?: boolean }) => void

  // State setters
  setError: <K extends keyof T>(name: K, error: string | undefined) => void
  setErrors: (errors: FormErrors<T>) => void
  setTouched: <K extends keyof T>(name: K, touched?: boolean) => void
  setAllTouched: (touched?: boolean) => void

  // Validation
  validateField: <K extends keyof T>(name: K) => Promise<string | undefined>
  validateForm: () => Promise<FormErrors<T>>
  clearErrors: () => void

  // Form actions
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  reset: (nextValues?: T) => void
  resetField: <K extends keyof T>(name: K, options?: { keepDirty?: boolean; keepTouched?: boolean; keepError?: boolean; defaultValue?: T[K] }) => void
}

// ============================================================================
// Built-in Validators
// ============================================================================

/**
 * Creates a required field validator
 */
export const required = (message = 'This field is required') =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (value === undefined || value === null || value === '') {
      return message
    }
    if (Array.isArray(value) && value.length === 0) {
      return message
    }
    return undefined
  }

/**
 * Creates a minimum length validator
 */
export const minLength = (min: number, message?: string) =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (typeof value === 'string' && value.length < min) {
      return message || `Must be at least ${min} characters`
    }
    return undefined
  }

/**
 * Creates a maximum length validator
 */
export const maxLength = (max: number, message?: string) =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (typeof value === 'string' && value.length > max) {
      return message || `Must be at most ${max} characters`
    }
    return undefined
  }

/**
 * Creates an email validator
 */
export const email = (message = 'Please enter a valid email address') =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (typeof value === 'string' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return message
      }
    }
    return undefined
  }

/**
 * Creates a pattern validator
 */
export const pattern = (regex: RegExp, message = 'Invalid format') =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (typeof value === 'string' && value && !regex.test(value)) {
      return message
    }
    return undefined
  }

/**
 * Creates a minimum value validator for numbers
 */
export const min = (minValue: number, message?: string) =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (typeof value === 'number' && value < minValue) {
      return message || `Must be at least ${minValue}`
    }
    return undefined
  }

/**
 * Creates a maximum value validator for numbers
 */
export const max = (maxValue: number, message?: string) =>
  <T, K extends keyof T>(value: T[K]): string | undefined => {
    if (typeof value === 'number' && value > maxValue) {
      return message || `Must be at most ${maxValue}`
    }
    return undefined
  }

/**
 * Creates a custom validator
 */
export const custom = <T, K extends keyof T>(
  validator: (value: T[K], values: T) => boolean,
  message: string
): ValidationRule<T, K> =>
  (value: T[K], values: T): string | undefined => {
    if (!validator(value, values)) {
      return message
    }
    return undefined
  }

/**
 * Creates a validator that checks if two fields match
 */
export const matches = <T, K extends keyof T>(
  fieldName: keyof T,
  message?: string
): ValidationRule<T, K> =>
  (value: T[K], values: T): string | undefined => {
    if (value !== values[fieldName]) {
      return message || `Must match ${String(fieldName)}`
    }
    return undefined
  }

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * A lightweight, type-safe form state management hook
 *
 * @example
 * ```tsx
 * interface LoginForm {
 *   email: string
 *   password: string
 * }
 *
 * const { register, handleSubmit, errors } = useForm<LoginForm>({
 *   initialValues: { email: '', password: '' },
 *   validationSchema: {
 *     email: [required(), email()],
 *     password: [required(), minLength(8)],
 *   },
 *   onSubmit: async (values) => {
 *     await login(values)
 *   },
 * })
 * ```
 */
export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    initialValues,
    validationSchema = {},
    validateOnChange = true,
    validateOnBlur = true,
    validateOnMount = false,
    onSubmit,
  } = options

  // Store initial values for reset
  const initialValuesRef = useRef(initialValues)

  // Form state
  const [values, setValuesState] = useState<T>(initialValues)
  const [errors, setErrorsState] = useState<FormErrors<T>>({})
  const [touched, setTouchedState] = useState<TouchedFields<T>>({})
  const [dirty, setDirtyState] = useState<DirtyFields<T>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [submitCount, setSubmitCount] = useState(0)

  // Computed state
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors])
  const isDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty])

  // Validate a single field
  const validateField = useCallback(async <K extends keyof T>(name: K): Promise<string | undefined> => {
    const fieldValidators = (validationSchema as ValidationSchema<T>)[name]
    if (!fieldValidators || fieldValidators.length === 0) {
      return undefined
    }

    for (const validator of fieldValidators) {
      const error = await validator(values[name], values)
      if (error) {
        return error
      }
    }

    return undefined
  }, [validationSchema, values])

  // Validate all fields
  const validateForm = useCallback(async (): Promise<FormErrors<T>> => {
    setIsValidating(true)
    const newErrors: FormErrors<T> = {}

    const fieldNames = Object.keys(validationSchema) as (keyof T)[]

    await Promise.all(
      fieldNames.map(async (name) => {
        const error = await validateField(name)
        if (error) {
          newErrors[name] = error
        }
      })
    )

    setErrorsState(newErrors)
    setIsValidating(false)
    return newErrors
  }, [validationSchema, validateField])

  // Validate on mount if enabled
  useEffect(() => {
    if (validateOnMount) {
      validateForm()
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set a single value
  const setValue = useCallback(<K extends keyof T>(
    name: K,
    value: T[K],
    options: { shouldValidate?: boolean; shouldDirty?: boolean; shouldTouch?: boolean } = {}
  ) => {
    const { shouldValidate = validateOnChange, shouldDirty = true, shouldTouch = false } = options

    setValuesState(prev => ({ ...prev, [name]: value }))

    if (shouldDirty) {
      const isDirtyField = value !== initialValuesRef.current[name]
      setDirtyState(prev => ({ ...prev, [name]: isDirtyField }))
    }

    if (shouldTouch) {
      setTouchedState(prev => ({ ...prev, [name]: true }))
    }

    if (shouldValidate) {
      // Validate after state update
      setTimeout(async () => {
        const error = await validateField(name)
        setErrorsState(prev => {
          if (error) {
            return { ...prev, [name]: error }
          }
          const { [name]: _, ...rest } = prev
          return rest as FormErrors<T>
        })
      }, 0)
    }
  }, [validateOnChange, validateField])

  // Set multiple values
  const setValues = useCallback((
    newValues: Partial<T>,
    options: { shouldValidate?: boolean } = {}
  ) => {
    const { shouldValidate = validateOnChange } = options

    setValuesState(prev => ({ ...prev, ...newValues }))

    // Update dirty state for each changed value
    const newDirty: DirtyFields<T> = {}
    for (const key of Object.keys(newValues) as (keyof T)[]) {
      newDirty[key] = newValues[key] !== initialValuesRef.current[key]
    }
    setDirtyState(prev => ({ ...prev, ...newDirty }))

    if (shouldValidate) {
      setTimeout(() => validateForm(), 0)
    }
  }, [validateOnChange, validateForm])

  // Set a single error
  const setError = useCallback(<K extends keyof T>(name: K, error: string | undefined) => {
    setErrorsState(prev => {
      if (error) {
        return { ...prev, [name]: error }
      }
      const { [name]: _, ...rest } = prev
      return rest as FormErrors<T>
    })
  }, [])

  // Set multiple errors
  const setErrors = useCallback((newErrors: FormErrors<T>) => {
    setErrorsState(newErrors)
  }, [])

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrorsState({})
  }, [])

  // Set touched state for a field
  const setTouched = useCallback(<K extends keyof T>(name: K, isTouched = true) => {
    setTouchedState(prev => ({ ...prev, [name]: isTouched }))
  }, [])

  // Set all fields as touched
  const setAllTouched = useCallback((isTouched = true) => {
    const allTouched: TouchedFields<T> = {}
    for (const key of Object.keys(values) as (keyof T)[]) {
      allTouched[key] = isTouched
    }
    setTouchedState(allTouched)
  }, [values])

  // Get field error
  const getFieldError = useCallback(<K extends keyof T>(name: K): string | undefined => {
    return errors[name]
  }, [errors])

  // Get field metadata
  const getFieldMeta = useCallback(<K extends keyof T>(name: K): FieldMeta<T, K> => {
    return {
      error: errors[name],
      touched: !!touched[name],
      dirty: !!dirty[name],
      value: values[name],
    }
  }, [errors, touched, dirty, values])

  // Handle field change
  const handleChange = useCallback(<K extends keyof T>(name: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { type } = e.target as HTMLInputElement
      let value: unknown

      if (type === 'checkbox') {
        value = (e.target as HTMLInputElement).checked
      } else if (type === 'number') {
        const parsed = parseFloat(e.target.value)
        value = isNaN(parsed) ? '' : parsed
      } else {
        value = e.target.value
      }

      setValue(name, value as T[K])
    }, [setValue])

  // Handle field blur
  const handleBlur = useCallback(<K extends keyof T>(name: K) =>
    async (_e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setTouchedState(prev => ({ ...prev, [name]: true }))

      if (validateOnBlur) {
        const error = await validateField(name)
        setErrorsState(prev => {
          if (error) {
            return { ...prev, [name]: error }
          }
          const { [name]: _, ...rest } = prev
          return rest as FormErrors<T>
        })
      }
    }, [validateOnBlur, validateField])

  // Register a field for use with inputs
  const register = useCallback(<K extends keyof T>(name: K): FieldProps<T, K> => {
    const errorId = errors[name] ? `${String(name)}-error` : undefined

    return {
      name,
      value: values[name],
      onChange: handleChange(name),
      onBlur: handleBlur(name),
      'aria-invalid': !!errors[name],
      'aria-describedby': errorId,
    }
  }, [values, errors, handleChange, handleBlur])

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    setSubmitCount(prev => prev + 1)
    setAllTouched(true)

    const validationErrors = await validateForm()

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    if (!onSubmit) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setIsSubmitting(false)
    }
  }, [validateForm, onSubmit, values, setAllTouched])

  // Reset the form to initial values
  const reset = useCallback((nextValues?: T) => {
    const resetValues = nextValues ?? initialValuesRef.current
    if (nextValues) {
      initialValuesRef.current = nextValues
    }

    setValuesState(resetValues)
    setErrorsState({})
    setTouchedState({})
    setDirtyState({})
    setIsSubmitting(false)
    setIsValidating(false)
  }, [])

  // Reset a single field
  const resetField = useCallback(<K extends keyof T>(
    name: K,
    options: { keepDirty?: boolean; keepTouched?: boolean; keepError?: boolean; defaultValue?: T[K] } = {}
  ) => {
    const { keepDirty = false, keepTouched = false, keepError = false, defaultValue } = options
    const resetValue = defaultValue ?? initialValuesRef.current[name]

    setValuesState(prev => ({ ...prev, [name]: resetValue }))

    if (!keepDirty) {
      setDirtyState(prev => {
        const { [name]: _, ...rest } = prev
        return rest as DirtyFields<T>
      })
    }

    if (!keepTouched) {
      setTouchedState(prev => {
        const { [name]: _, ...rest } = prev
        return rest as TouchedFields<T>
      })
    }

    if (!keepError) {
      setErrorsState(prev => {
        const { [name]: _, ...rest } = prev
        return rest as FormErrors<T>
      })
    }
  }, [])

  return {
    // State
    values,
    errors,
    touched,
    dirty,
    isSubmitting,
    isValidating,
    isValid,
    isDirty,
    submitCount,

    // Field helpers
    register,
    getFieldMeta,
    getFieldError,

    // Value setters
    setValue,
    setValues,

    // State setters
    setError,
    setErrors,
    setTouched,
    setAllTouched,

    // Validation
    validateField,
    validateForm,
    clearErrors,

    // Form actions
    handleSubmit,
    reset,
    resetField,
  }
}

export default useForm
