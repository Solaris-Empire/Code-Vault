import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface UserProfile {
  id: string
  email: string
  role: string
  display_name?: string
}

export interface AuthResult {
  success: boolean
  user?: { id: string; email?: string | null }
  profile?: UserProfile
  error?: NextResponse
}

// Verify that a request is authenticated
export async function requireAuth(request?: NextRequest): Promise<AuthResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        success: false,
        error: NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 }),
      }
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id, role, email, display_name')
      .eq('id', user.id)
      .single()

    return {
      success: true,
      user: { id: user.id, email: user.email },
      profile: {
        id: user.id,
        email: profile?.email || user.email || '',
        role: profile?.role || 'buyer',
        display_name: profile?.display_name || undefined,
      },
    }
  } catch {
    return {
      success: false,
      error: NextResponse.json({ error: { message: 'Authentication failed' } }, { status: 401 }),
    }
  }
}

// Verify admin role
export async function requireAdmin(request?: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)
  if (!authResult.success) return authResult

  if (authResult.profile!.role !== 'admin') {
    return {
      success: false,
      error: NextResponse.json({ error: { message: 'Admin access required' } }, { status: 403 }),
    }
  }
  return authResult
}

// Verify seller role
export async function requireSeller(request?: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)
  if (!authResult.success) return authResult

  if (!['seller', 'admin'].includes(authResult.profile!.role)) {
    return {
      success: false,
      error: NextResponse.json({ error: { message: 'Seller access required' } }, { status: 403 }),
    }
  }
  return authResult
}

export function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1'
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'Unknown'
}
