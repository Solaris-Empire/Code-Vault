import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── GET /api/downloads/[productId] ────────────────────────────────
// Generates a signed download URL for a purchased product.
// Only buyers who own the product (have a completed order) can download.
// Signed URLs expire after 1 hour for security.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
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
  const storagePath = urlObj.pathname.includes(publicPrefix)
    ? urlObj.pathname.split(publicPrefix)[1]
    : fileUrl // Fallback: use as-is if format doesn't match

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

  // Increment download count — non-critical, don't fail the download if this errors
  try {
    const { data: currentProduct } = await admin
      .from('products')
      .select('download_count')
      .eq('id', productId)
      .single()

    if (currentProduct) {
      await admin
        .from('products')
        .update({ download_count: (currentProduct.download_count || 0) + 1 })
        .eq('id', productId)
    }
  } catch {
    // Non-critical — silently continue
  }

  // Redirect to the signed download URL
  return NextResponse.redirect(signedData.signedUrl)
}
