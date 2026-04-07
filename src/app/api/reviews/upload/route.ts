import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

export async function POST(request: NextRequest) {
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
      // Validate file type
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

      // Generate unique filename
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `reviews/${user.id}/${timestamp}-${randomStr}.${ext}`

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('review-images')
        .upload(fileName, buffer, {
          contentType: file.type,
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
              contentType: file.type,
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
