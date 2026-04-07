import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSeller } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Zod schema for creating a product ─────────────────────────────
// Every API input is validated with Zod before touching the database.
// This prevents malformed data from entering the system.
const createProductSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
  short_description: z.string().max(200).optional().default(''),
  description: z.string().optional().default(''),
  price_cents: z.number().int().min(0),
  category_id: z.string().uuid(),
  demo_url: z.string().url().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(['draft', 'pending']).default('draft'),
  // File info — used to create a product_files row alongside the product
  file_url: z.string(),
  file_name: z.string(),
  file_size_bytes: z.number().int().positive(),
  version: z.string().default('1.0.0'),
  changelog: z.string().nullable().optional(),
})

// ─── GET /api/seller/products ──────────────────────────────────────
// Returns all products belonging to the authenticated seller.
// Used by the seller dashboard to list their products.
export async function GET(request: NextRequest) {
  const auth = await requireSeller(request)
  if (!auth.success) return auth.error!

  const admin = getSupabaseAdmin()

  const { data: products, error } = await admin
    .from('products')
    .select(`
      id, title, slug, status, price_cents, download_count,
      avg_rating, review_count, thumbnail_url, created_at, updated_at,
      category:categories(name, slug)
    `)
    .eq('seller_id', auth.user!.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { message: 'Failed to fetch products' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: products || [],
    meta: { total: products?.length || 0 },
  })
}

// ─── POST /api/seller/products ─────────────────────────────────────
// Creates a new product + its initial product_files entry.
// The upload form at /seller/products/new calls this after uploading
// the thumbnail and product file to Supabase Storage.
export async function POST(request: NextRequest) {
  const auth = await requireSeller(request)
  if (!auth.success) return auth.error!

  // Parse and validate the request body
  let body: z.infer<typeof createProductSchema>
  try {
    const raw = await request.json()
    body = createProductSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Validation failed', details: err.issues } },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: { message: 'Invalid request body' } },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Check for duplicate slug — slugs must be unique across all products
  const { data: existingSlug } = await admin
    .from('products')
    .select('id')
    .eq('slug', body.slug)
    .maybeSingle()

  if (existingSlug) {
    return NextResponse.json(
      { error: { message: 'A product with this slug already exists. Please choose a different title.' } },
      { status: 409 }
    )
  }

  // Verify the category exists
  const { data: category } = await admin
    .from('categories')
    .select('id')
    .eq('id', body.category_id)
    .maybeSingle()

  if (!category) {
    return NextResponse.json(
      { error: { message: 'Invalid category' } },
      { status: 400 }
    )
  }

  // ─── Create the product row ──────────────────────────────────────
  const { data: product, error: productError } = await admin
    .from('products')
    .insert({
      seller_id: auth.user!.id,
      title: body.title,
      slug: body.slug,
      short_description: body.short_description,
      description: body.description,
      price_cents: body.price_cents,
      category_id: body.category_id,
      demo_url: body.demo_url || null,
      thumbnail_url: body.thumbnail_url || null,
      tags: body.tags,
      status: body.status,
      download_count: 0,
      avg_rating: null,
      review_count: 0,
    })
    .select('id, title, slug, status')
    .single()

  if (productError || !product) {
    console.error('Product creation failed:', productError)
    return NextResponse.json(
      { error: { message: 'Failed to create product' } },
      { status: 500 }
    )
  }

  // ─── Create the product_files row ────────────────────────────────
  // This links the uploaded file to the product and tracks versioning.
  const { error: fileError } = await admin
    .from('product_files')
    .insert({
      product_id: product.id,
      file_url: body.file_url,
      file_name: body.file_name,
      file_size_bytes: body.file_size_bytes,
      version: body.version,
      changelog: body.changelog || null,
    })

  if (fileError) {
    // If file record fails, clean up the product to avoid orphans
    console.error('Product file creation failed:', fileError)
    await admin.from('products').delete().eq('id', product.id)
    return NextResponse.json(
      { error: { message: 'Failed to save file information' } },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      data: product,
      meta: { message: body.status === 'draft' ? 'Product saved as draft' : 'Product submitted for review' },
    },
    { status: 201 }
  )
}
