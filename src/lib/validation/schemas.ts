import { z } from 'zod'

// ==========================================
// COMMON VALIDATORS
// ==========================================

export const uuidSchema = z.string().uuid('Invalid ID format')

export const emailSchema = z.string()
  .email('Invalid email address')
  .max(255, 'Email too long')
  .transform(val => val.toLowerCase().trim())

export const phoneSchema = z.string()
  .regex(/^[\d\s\-+()]+$/, 'Invalid phone number')
  .min(10, 'Phone number too short')
  .max(20, 'Phone number too long')
  .optional()
  .or(z.literal(''))

export const urlSchema = z.string()
  .url('Invalid URL')
  .max(2048, 'URL too long')
  .optional()
  .or(z.literal(''))

export const slugSchema = z.string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only')
  .min(2, 'Slug too short')
  .max(100, 'Slug too long')

export const priceSchema = z.number()
  .int('Price must be a whole number (in pence)')
  .min(0, 'Price cannot be negative')
  .max(999999999, 'Price too large')

// ==========================================
// PAGINATION
// ==========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc')
})

export const searchQuerySchema = z.object({
  q: z.string().max(500).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

// ==========================================
// PRODUCT SCHEMAS
// ==========================================

export const productCreateSchema = z.object({
  name: z.string().min(1, 'Name required').max(200, 'Name too long'),
  slug: slugSchema,
  sku: z.string().max(50).optional(),
  description: z.string().max(10000).optional(),
  short_description: z.string().max(500).optional(),
  price_pence: priceSchema,
  compare_at_price_pence: priceSchema.optional(),
  cost_price_pence: priceSchema.optional(),
  category_id: uuidSchema.optional(),
  brand: z.string().max(100).optional(),
  image_url: urlSchema,
  images: z.array(z.string().url()).max(10).optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  stock_quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  track_inventory: z.boolean().default(true),
  allow_backorder: z.boolean().default(false),
  weight_grams: z.number().int().min(0).optional(),
  unit: z.string().max(20).default('each'),
  unit_value: z.number().positive().optional(),
  is_vegan: z.boolean().default(false),
  is_vegetarian: z.boolean().default(false),
  is_gluten_free: z.boolean().default(false),
  is_organic: z.boolean().default(false),
  allergens: z.array(z.string().max(50)).max(20).optional(),
  meta_title: z.string().max(70).optional(),
  meta_description: z.string().max(160).optional(),
  vendor_id: uuidSchema.optional()
})

export const productUpdateSchema = productCreateSchema.partial()

// ==========================================
// ORDER SCHEMAS
// ==========================================

export const orderItemSchema = z.object({
  product_id: uuidSchema,
  quantity: z.number().int().min(1).max(99),
  price_pence: priceSchema,
  name: z.string().max(200)
})

export const orderCreateSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item').max(50),
  customer_name: z.string().min(2, 'Name required').max(100),
  customer_email: emailSchema,
  customer_phone: phoneSchema,
  delivery_address: z.string().min(10, 'Address required').max(500),
  delivery_city: z.string().min(2).max(100),
  delivery_postcode: z.string().min(3).max(20),
  delivery_instructions: z.string().max(500).optional(),
  delivery_slot_id: uuidSchema.optional(),
  subtotal_pence: priceSchema,
  delivery_fee_pence: priceSchema.default(0),
  discount_pence: priceSchema.default(0),
  total_pence: priceSchema,
  coupon_code: z.string().max(50).optional(),
  payment_intent_id: z.string().max(255).optional(),
  notes: z.string().max(1000).optional()
})

export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded'
])

export const orderUpdateSchema = z.object({
  status: orderStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
  delivery_slot_id: uuidSchema.optional()
})

// ==========================================
// REVIEW SCHEMAS
// ==========================================

export const reviewCreateSchema = z.object({
  product_id: uuidSchema,
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  title: z.string().max(100).optional(),
  content: z.string().max(5000).optional(),
  images: z.array(z.string().url()).max(5).optional()
})

export const reviewUpdateSchema = z.object({
  title: z.string().max(100).optional(),
  content: z.string().max(5000).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional()
})

// ==========================================
// USER SCHEMAS
// ==========================================

export const userProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: phoneSchema,
  avatar_url: urlSchema,
  default_address: z.string().max(500).optional(),
  default_city: z.string().max(100).optional(),
  default_postcode: z.string().max(20).optional()
})

export const passwordSchema = z.string()
  .min(10, 'Password must be at least 10 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character')

export const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

export const signUpSchema = authSchema.extend({
  full_name: z.string().min(2, 'Name required').max(100)
})

// ==========================================
// CATEGORY SCHEMAS
// ==========================================

export const categorySchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  image_url: urlSchema,
  emoji: z.string().max(10).optional(),
  parent_id: uuidSchema.optional().nullable(),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true)
})

// ==========================================
// VENDOR SCHEMAS
// ==========================================

export const vendorApplicationSchema = z.object({
  business_name: z.string().min(2).max(200),
  business_type: z.string().max(100),
  description: z.string().max(2000).optional(),
  contact_name: z.string().min(2).max(100),
  contact_email: emailSchema,
  contact_phone: z.string().min(10).max(20),
  address: z.string().max(500),
  city: z.string().max(100),
  postcode: z.string().max(20),
  website: urlSchema,
  logo_url: urlSchema,
  banner_url: urlSchema
})

// ==========================================
// COUPON SCHEMAS
// ==========================================

export const couponSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  description: z.string().max(500).optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  minimum_order_pence: priceSchema.default(0),
  maximum_discount_pence: priceSchema.optional(),
  usage_limit: z.number().int().min(1).optional(),
  per_user_limit: z.number().int().min(1).default(1),
  starts_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
  is_active: z.boolean().default(true)
})

// ==========================================
// CONTACT/MESSAGE SCHEMAS
// ==========================================

export const contactMessageSchema = z.object({
  name: z.string().min(2, 'Name required').max(100),
  email: emailSchema,
  subject: z.string().min(5, 'Subject required').max(200),
  message: z.string().min(10, 'Message too short').max(5000)
})

// ==========================================
// NEWSLETTER SCHEMAS
// ==========================================

export const newsletterSubscribeSchema = z.object({
  email: emailSchema,
  name: z.string().max(100).optional()
})

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Parse and validate data with a schema
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}

/**
 * Parse query parameters with pagination defaults
 */
export function parseQueryParams(searchParams: URLSearchParams): {
  page: number
  limit: number
  sort?: string
  order: 'asc' | 'desc'
} {
  const result = paginationSchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sort: searchParams.get('sort'),
    order: searchParams.get('order')
  })

  return result.success ? result.data : { page: 1, limit: 20, order: 'desc' }
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(zodError: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}

  for (const issue of zodError.issues) {
    const path = issue.path.join('.') || 'root'
    if (!formatted[path]) {
      formatted[path] = []
    }
    formatted[path].push(issue.message)
  }

  return formatted
}
