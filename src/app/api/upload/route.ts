import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/verify'
import { logFileUpload, sanitizeFilename } from '@/lib/security'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'
import { captureError } from '@/lib/error-tracking'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ─── Allowed file types per bucket ─────────────────────────────────
// The "bucket" form field determines which storage bucket and which
// file types are accepted. This prevents someone from uploading a
// PHP shell disguised as a product file into the thumbnails bucket.
const BUCKET_CONFIG: Record<string, {
  allowedTypes: string[]
  allowedExtensions: string[]
  maxSizeMB: number
  pathPrefix: string
}> = {
  thumbnails: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    maxSizeMB: 10,
    pathPrefix: 'products',
  },
  'product-files': {
    allowedTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/gzip',
      'application/x-gzip',
      'application/x-tar',
      'application/x-compressed-tar',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/octet-stream', // Browsers sometimes use this for ZIP/RAR
    ],
    allowedExtensions: ['zip', 'tar.gz', 'tgz', 'rar', 'gz'],
    maxSizeMB: 500, // Large code packages allowed up to 500MB
    pathPrefix: 'uploads',
  },
  // Default: treat as image upload (backwards compatibility)
  'product-images': {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    maxSizeMB: 5,
    pathPrefix: 'products',
  },
  // Deliverables from sellers to buyers for hire orders. Broad file
  // tolerance because engagements vary (zips, PDFs, screenshots, code).
  'service-deliveries': {
    allowedTypes: [
      'application/zip', 'application/x-zip-compressed',
      'application/gzip', 'application/x-gzip',
      'application/x-tar', 'application/x-compressed-tar',
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'text/plain', 'text/markdown',
      'application/octet-stream',
    ],
    allowedExtensions: [
      'zip', 'tar.gz', 'tgz', 'gz',
      'pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif',
      'txt', 'md', 'json',
    ],
    maxSizeMB: 200,
    pathPrefix: 'deliveries',
  },
}

export async function POST(request: NextRequest) {
  // Strict throttle — uploads allow up to 500MB per call. Without this
  // a single authed account can eat storage + egress budget in minutes.
  const rl = await checkRateLimit(request, rateLimitConfigs.upload)
  if (!rl.allowed) return rl.error!

  // Verify user authentication
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const formData = await request.formData()
  const file = formData.get('file') as File
  const bucketName = (formData.get('bucket') as string) || 'product-images'

  if (!file) {
    return NextResponse.json(
      { error: { message: 'No file provided' } },
      { status: 400 }
    )
  }

  // Look up the config for this bucket
  const config = BUCKET_CONFIG[bucketName]
  if (!config) {
    return NextResponse.json(
      { error: { message: `Invalid bucket: ${bucketName}` } },
      { status: 400 }
    )
  }

  // Sanitize filename to prevent path traversal
  const sanitizedOriginalName = sanitizeFilename(file.name)
  const fileExt = getFileExtension(sanitizedOriginalName)

  // Validate extension against the bucket's allowed list
  if (!config.allowedExtensions.includes(fileExt)) {
    return NextResponse.json(
      { error: { message: `Invalid file extension ".${fileExt}". Allowed: ${config.allowedExtensions.join(', ')}` } },
      { status: 400 }
    )
  }

  // Validate file size
  const maxSizeBytes = config.maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return NextResponse.json(
      { error: { message: `File too large. Maximum size is ${config.maxSizeMB}MB.` } },
      { status: 400 }
    )
  }

  // For image uploads, validate MIME type and magic bytes
  const isImageBucket = bucketName === 'thumbnails' || bucketName === 'product-images'

  if (isImageBucket) {
    if (!config.allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: { message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' } },
        { status: 400 }
      )
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Verify magic bytes for images to prevent disguised files
  if (isImageBucket && !verifyMagicBytes(buffer, file.type)) {
    return NextResponse.json(
      { error: { message: 'File content does not match declared type' } },
      { status: 400 }
    )
  }

  // For product files, verify it's actually a ZIP/GZIP/RAR archive
  if (bucketName === 'product-files' && !verifyArchiveMagicBytes(buffer)) {
    return NextResponse.json(
      { error: { message: 'File does not appear to be a valid archive (ZIP, GZIP, RAR)' } },
      { status: 400 }
    )
  }

  // Service deliveries accept a broader mix (archives, PDFs, images,
  // text). Verify the declared extension matches the actual bytes so a
  // seller can't smuggle an executable through as ".pdf".
  if (bucketName === 'service-deliveries' && !verifyDeliveryMagicBytes(buffer, fileExt)) {
    return NextResponse.json(
      { error: { message: 'File content does not match the declared file type' } },
      { status: 400 },
    )
  }

  // Generate a unique filename to prevent collisions
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
  const filePath = `${config.pathPrefix}/${uniqueName}`

  // Upload to Supabase Storage
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: file.type,
    })

  if (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      context: 'api:upload',
      extra: { bucket: bucketName, size: file.size },
    })
    return NextResponse.json(
      { error: { message: 'Upload failed. Please try again.' } },
      { status: 500 }
    )
  }

  // Get the public URL for the uploaded file
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(filePath)

  // Log file upload for audit trail
  if (auth.user) {
    await logFileUpload(
      request,
      { id: auth.user.id, email: auth.user.email || '', role: auth.profile?.role || 'buyer' },
      sanitizedOriginalName,
      file.size,
      file.type,
      filePath
    )
  }

  return NextResponse.json({
    data: {
      url: publicUrl,
      fileName: sanitizedOriginalName,
      fileSize: file.size,
      bucket: bucketName,
    },
    // Also return url at top level for backwards compatibility
    url: publicUrl,
  })
}

// ─── Helper: extract file extension ────────────────────────────────
// Handles compound extensions like .tar.gz properly
function getFileExtension(filename: string): string {
  if (filename.endsWith('.tar.gz')) return 'tar.gz'
  return (filename.split('.').pop() || '').toLowerCase()
}

// ─── Helper: verify image magic bytes ──────────────────────────────
// Checks the first few bytes of a file to ensure it's actually the
// declared image type, not a renamed executable or script.
function verifyMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  if (buffer.length < 4) return false

  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  }

  const expected = signatures[mimeType]
  if (!expected) return false

  return expected.some(sig =>
    sig.every((byte, i) => buffer[i] === byte)
  )
}

// ─── Helper: verify archive magic bytes ────────────────────────────
// Ensures product files are actual archives, not disguised scripts.
function verifyArchiveMagicBytes(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false

  // ZIP: PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return true
  // GZIP: \x1F\x8B
  if (buffer[0] === 0x1F && buffer[1] === 0x8B) return true
  // RAR: Rar!\x1A\x07
  if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) return true

  return false
}

// ─── Helper: verify service-delivery magic bytes ───────────────────
// Service deliveries allow a mixed bag — verify each extension maps to
// the expected header so a seller can't smuggle an executable through
// as ".pdf" or ".png". Plaintext formats (txt/md/json) have no magic
// bytes, so we accept those based on extension alone.
function verifyDeliveryMagicBytes(buffer: Uint8Array, ext: string): boolean {
  if (ext === 'txt' || ext === 'md' || ext === 'json') return true
  if (buffer.length < 4) return false

  switch (ext) {
    case 'zip':
      return verifyArchiveMagicBytes(buffer) && buffer[0] === 0x50 && buffer[1] === 0x4B
    case 'gz':
    case 'tgz':
    case 'tar.gz':
      return buffer[0] === 0x1F && buffer[1] === 0x8B
    case 'pdf':
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 // %PDF
    case 'jpg':
    case 'jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
    case 'png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
    case 'gif':
      return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38
    case 'webp':
      return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 // RIFF
    default:
      return false
  }
}
