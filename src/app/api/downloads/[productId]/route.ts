import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// ─── GET /api/downloads/[productId] ────────────────────────────────
// Generates a signed download URL for a purchased product.
// Only buyers who own the product (have a completed order) can download.
// Signed URLs expire after 1 hour for security.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  // Strict throttle — every call mints a fresh 1-hour signed CDN URL and
  // touches storage + DB. A compromised session without this limit would
  // let an attacker scrape unlimited download URLs.
  const rl = checkRateLimit(request, rateLimitConfigs.sensitive)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { productId } = await params
  const admin = getSupabaseAdmin()

  // Verify the buyer owns this product (has a completed order)
  const { data: order } = await admin
    .from('orders')
    .select('id')
    .eq('product_id', productId)
    .eq('buyer_id', auth.user!.id)
    .eq('status', 'completed')
    .maybeSingle()

  if (!order) {
    return NextResponse.json(
      { error: { message: 'You have not purchased this product' } },
      { status: 403 }
    )
  }

  // Check the license is still valid — extended licenses can expire.
  // A NULL expires_at means the license never expires (regular perpetual).
  // If a license row exists but is expired, reject the download. If no
  // license row exists at all (legacy orders pre-license-system) we fall
  // back to allowing the download since the completed order is proof.
  const { data: license } = await admin
    .from('licenses')
    .select('id, expires_at')
    .eq('product_id', productId)
    .eq('buyer_id', auth.user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (license?.expires_at && new Date(license.expires_at) < new Date()) {
    return NextResponse.json(
      {
        error: {
          message: 'Your license has expired. Renew it to download again.',
          code: 'LICENSE_EXPIRED',
        },
      },
      { status: 403 }
    )
  }

  // Get the latest product file
  const { data: productFile } = await admin
    .from('product_files')
    .select('file_url, file_name, file_size_bytes')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!productFile) {
    return NextResponse.json(
      { error: { message: 'Product file not found' } },
      { status: 404 }
    )
  }

  // Extract the storage path from the file URL
  // File URLs are stored as full public URLs from Supabase Storage.
  // We need the path portion to generate a signed URL.
  const fileUrl = productFile.file_url
  const bucketName = 'product-files'

  // Parse the path from the public URL
  // Format: https://<project>.supabase.co/storage/v1/object/public/product-files/<path>
  const publicPrefix = `/storage/v1/object/public/${bucketName}/`
  const urlObj = new URL(fileUrl)
  if (!urlObj.pathname.includes(publicPrefix)) {
    // Fail closed — a malformed row is a schema bug, not something we
    // should paper over by passing the raw URL into createSignedUrl.
    console.error('Download: file_url is not a canonical Supabase Storage URL', { productId })
    return NextResponse.json(
      { error: { message: 'Download not available. Contact support.' } },
      { status: 500 },
    )
  }
  const storagePath = urlObj.pathname.split(publicPrefix)[1]

  // Generate a signed URL (expires in 1 hour)
  const { data: signedData, error: signError } = await admin.storage
    .from(bucketName)
    .createSignedUrl(storagePath, 3600) // 3600 seconds = 1 hour

  if (signError || !signedData?.signedUrl) {
    console.error('Signed URL generation failed:', signError)
    return NextResponse.json(
      { error: { message: 'Failed to generate download link' } },
      { status: 500 }
    )
  }

  // Increment download count atomically via RPC so concurrent downloads
  // don't lose increments. Non-critical — never fail the download on a
  // counter error.
  try {
    await admin.rpc('increment_product_download_count', { p_product_id: productId })
  } catch {
    // Non-critical — silently continue
  }

  // Redirect to the signed download URL
  return NextResponse.redirect(signedData.signedUrl)
}
