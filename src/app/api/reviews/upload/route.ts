import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGES = 5

// Sniff the real image type from its magic bytes. The Content-Type header
// on an uploaded File is user-controlled — a renamed .exe can claim to be
// image/png. This returns the real MIME, or null if the bytes don't match
// any of our allowed types.
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png'
  // GIF: "GIF87a" or "GIF89a"
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return 'image/gif'
  // WebP: "RIFF" <size> "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp'
  return null
}

// Map real MIME to a safe extension so the filename we store can't be
// manipulated by the user (original `file.name` is attacker-controlled).
const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: NextRequest) {
  // Strict throttle — each call accepts up to 5 × 5MB images.
  const rl = await checkRateLimit(request, rateLimitConfigs.upload)
  if (!rl.allowed) return rl.error!

  try {
    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const uploadedUrls: string[] = []

    for (const file of files) {
      // Cheap rejection first: if the claimed header is already not an
      // allowed type, don't even bother reading the buffer.
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({
          error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`
        }, { status: 400 })
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({
          error: `File ${file.name} exceeds 5MB limit`
        }, { status: 400 })
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Magic-byte check: the claimed Content-Type is not trustworthy.
      // Verify the actual file signature matches one of our allowed
      // image types before storing it.
      const realMime = sniffImageType(buffer)
      if (!realMime || !ALLOWED_TYPES.includes(realMime)) {
        return NextResponse.json({
          error: 'File content does not match an allowed image type',
        }, { status: 400 })
      }

      // Use the sniffed extension, not the user-provided filename, so a
      // disguised payload can't slip in through the stored path.
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const ext = EXT_FOR_MIME[realMime]
      const fileName = `reviews/${user.id}/${timestamp}-${randomStr}.${ext}`

      // Upload to Supabase Storage with the sniffed (real) content type.
      const { data, error } = await supabaseAdmin.storage
        .from('review-images')
        .upload(fileName, buffer, {
          contentType: realMime,
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        // If bucket doesn't exist, try to create it
        if (error.message.includes('Bucket not found')) {
          await supabaseAdmin.storage.createBucket('review-images', {
            public: true,
            allowedMimeTypes: ALLOWED_TYPES,
            fileSizeLimit: MAX_FILE_SIZE
          })
          // Retry upload
          const { data: retryData, error: retryError } = await supabaseAdmin.storage
            .from('review-images')
            .upload(fileName, buffer, {
              contentType: realMime,
              cacheControl: '3600',
              upsert: false
            })

          if (retryError) {
            console.error('Retry upload error:', retryError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
          }

          const { data: urlData } = supabaseAdmin.storage
            .from('review-images')
            .getPublicUrl(retryData.path)

          uploadedUrls.push(urlData.publicUrl)
          continue
        }
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('review-images')
        .getPublicUrl(data.path)

      uploadedUrls.push(urlData.publicUrl)
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls
    })
  } catch (error) {
    console.error('Review image upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
