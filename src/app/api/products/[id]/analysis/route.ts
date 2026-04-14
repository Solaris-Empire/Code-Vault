// GET: fetch the code-quality analysis report for a product (public).
// POST: rerun the analysis for a product (owner or admin only).

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { runAnalysisForProduct, parseStorageUrl } from '@/lib/analysis/store'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Cheap throttle on the public read — stops a competitor from
  // bulk-scraping every product's full analysis JSON.
  const rl = checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  const { id } = await params
  const admin = getSupabaseAdmin()

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  // Resolve slug → product_id and read visibility flags in one go.
  const productQuery = admin.from('products').select('id, seller_id, show_ai_detection')
  const { data: prod } = await (isUuid
    ? productQuery.eq('id', id).maybeSingle()
    : productQuery.eq('slug', id).maybeSingle())

  if (!prod) {
    return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 })
  }

  const { data, error } = await admin
    .from('product_analyses')
    .select('*')
    .eq('product_id', prod.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to fetch analysis' } }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ data: null, meta: { status: 'missing' } })
  }

  // Honor the seller's "hide AI detection" toggle. Owner + admin still see
  // it; everyone else gets the field stripped from the report JSONB.
  const showAi = prod.show_ai_detection ?? true
  if (!showAi && data.report && typeof data.report === 'object') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let canSeeAi = false
    if (user) {
      if (user.id === prod.seller_id) {
        canSeeAi = true
      } else {
        const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
        canSeeAi = profile?.role === 'admin'
      }
    }
    if (!canSeeAi) {
      const report = { ...(data.report as Record<string, unknown>) }
      delete report.aiDetection
      data.report = report
    }
  }

  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Strict throttle — each rerun pulls the ZIP, extracts, fingerprints,
  // and hits OSV. Without this a single account can DoS the worker.
  const rl = checkRateLimit(request, rateLimitConfigs.upload)
  if (!rl.allowed) return rl.error!

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
  }

  const { id } = await params
  const admin = getSupabaseAdmin()

  // Auth: must be product owner or admin
  const { data: product } = await admin
    .from('products')
    .select('id, seller_id')
    .eq('id', id)
    .single()

  if (!product) {
    return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 })
  }

  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  const isOwner = product.seller_id === user.id
  const isAdmin = profile?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  // Look up the latest uploaded file for this product
  const { data: file } = await admin
    .from('product_files')
    .select('file_url')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!file?.file_url) {
    return NextResponse.json({ error: { message: 'No product file found to analyze' } }, { status: 400 })
  }

  const storageRef = parseStorageUrl(file.file_url)
  if (!storageRef) {
    return NextResponse.json({ error: { message: 'Product file URL is not a Supabase Storage URL' } }, { status: 400 })
  }

  // Mark pending and kick off (fire-and-forget)
  await admin
    .from('product_analyses')
    .upsert(
      {
        product_id: product.id,
        quality_score: 0,
        grade: 'F',
        total_loc: 0,
        total_files: 0,
        dependency_count: 0,
        issue_count: 0,
        report: {},
        status: 'pending',
        error_message: null,
      },
      { onConflict: 'product_id' }
    )

  runAnalysisForProduct({
    productId: product.id,
    bucket: storageRef.bucket,
    objectPath: storageRef.objectPath,
  }).catch((err) => {
    console.error('[analyzer:rerun] Unhandled error', product.id, err)
  })

  return NextResponse.json({ data: { status: 'pending' } })
}
