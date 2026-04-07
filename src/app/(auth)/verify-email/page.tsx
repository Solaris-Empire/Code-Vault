'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, CheckCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function VerifyEmailPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'pending'>('pending')
  const [email, setEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkVerification = async () => {
      const supabase = createClient()

      // Check if this is a callback from email verification
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const code = searchParams.get('code')

      // Handle token_hash verification (supports email, signup, and invite types)
      if (token_hash && type) {
        setStatus('verifying')
        try {
          const otpType = type === 'invite' ? 'invite' : type === 'signup' ? 'signup' : 'email'
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: otpType,
          })

          if (error) {
            setStatus('error')
            setError(error.message)
          } else {
            setStatus('success')
            setTimeout(() => {
              router.push('/')
            }, 3000)
          }
        } catch (err) {
          setStatus('error')
          setError('Verification failed. Please try again.')
        }
        return
      }

      // Handle code exchange (PKCE flow)
      if (code) {
        setStatus('verifying')
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setStatus('error')
            setError(error.message)
          } else {
            setStatus('success')
            setTimeout(() => {
              router.push('/')
            }, 3000)
          }
        } catch (err) {
          setStatus('error')
          setError('Verification failed. Please try again.')
        }
        return
      }

      // Handle hash fragment (implicit flow - #access_token=...)
      // Supabase client auto-detects hash fragments via onAuthStateChange
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setStatus('success')
          setTimeout(() => {
            router.push('/')
          }, 3000)
        }
      })

      // Check if user is already verified
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || null)
        if (user.email_confirmed_at) {
          setStatus('success')
        }
      }

      // Cleanup subscription after a timeout if nothing happens
      setTimeout(() => {
        subscription.unsubscribe()
      }, 10000)
    }

    checkVerification()
  }, [searchParams, router])

  const handleResendEmail = async () => {
    if (!email) return

    setIsResending(true)
    setResendSuccess(false)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })

      if (error) {
        setError(error.message)
      } else {
        setResendSuccess(true)
      }
    } catch (err) {
      setError('Failed to resend verification email.')
    } finally {
      setIsResending(false)
    }
  }

  // Verifying state
  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying your email...</h1>
            <p className="text-gray-600">Please wait while we verify your email address.</p>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h1>
            <p className="text-gray-600 mb-6">
              Your email has been verified successfully. You can now access all features.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification failed</h1>
            <p className="text-gray-600 mb-6">
              {error || 'The verification link is invalid or has expired.'}
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Go to login
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Create new account
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Pending state - waiting for verification
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h1>
          <p className="text-gray-600 mb-6">
            {email ? (
              <>
                We've sent a verification link to{' '}
                <span className="font-medium text-gray-900">{email}</span>
              </>
            ) : (
              'Please check your email for the verification link.'
            )}
          </p>

          {/* Resend success message */}
          {resendSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              Verification email sent! Check your inbox.
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-gray-900 mb-2">Next steps:</h3>
            <ol className="text-sm text-gray-600 space-y-2">
              <li>1. Check your email inbox</li>
              <li>2. Click the verification link</li>
              <li>3. Start shopping!</li>
            </ol>
          </div>

          {/* Resend button */}
          {email && (
            <button
              onClick={handleResendEmail}
              disabled={isResending}
              className="inline-flex items-center justify-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend verification email
                </>
              )}
            </button>
          )}

          {/* Divider */}
          <div className="my-6 border-t border-gray-200"></div>

          {/* Back to login */}
          <p className="text-sm text-gray-500">
            Wrong email?{' '}
            <Link href="/register" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign up again
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function VerifyEmailPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-emerald-600 mb-4" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailPageLoading />}>
      <VerifyEmailPageContent />
    </Suspense>
  )
}
