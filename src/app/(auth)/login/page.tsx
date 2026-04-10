'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye,
  EyeOff,
  Loader2,
  Code2,
  Zap,
  Shield,
  Download,
  Mail,
  Lock,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { SocialLoginButtons } from '@/components/auth/social-login-buttons'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

const benefits = [
  { icon: Download, title: 'Instant Downloads', description: 'Access your purchased code immediately' },
  { icon: Zap, title: 'Earn 85%', description: 'Sell your code and keep 85% of every sale' },
  { icon: Shield, title: 'License Protection', description: 'Unique license keys for every purchase' },
]

function LoginFormContent() {
  const searchParams = useSearchParams()
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null)
      await signIn(data.email, data.password)

      const redirectParam = searchParams.get('redirectTo')
      if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
        window.location.href = redirectParam
        return
      }

      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const result = await res.json()
        const profile = result.data || result
        if (profile.role === 'admin') window.location.href = '/admin'
        else if (profile.role === 'seller') window.location.href = '/seller/dashboard'
        else window.location.href = '/'
      } else {
        window.location.href = '/'
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 bg-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <Code2 className="h-10 w-10 text-green-600" />
              <span className="text-2xl font-bold text-gray-900 tracking-tight">CodeVault</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Welcome back</h1>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                    <Input
                      id="email" type="email" placeholder="you@example.com"
                      className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-200 rounded-xl"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-gray-700">Password</Label>
                    <Link href="/forgot-password" className="text-sm text-green-600 hover:text-green-700">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                    <Input
                      id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password"
                      className="pl-10 pr-10 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-200 rounded-xl"
                      {...register('password')}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                </div>

                <Button type="submit" className="w-full h-12 text-base font-semibold btn-primary rounded-xl border-0" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing in...</>) : (<>Sign In <ArrowRight className="ml-2 h-5 w-5" /></>)}
                </Button>
              </form>

              <SocialLoginButtons />

              <div className="mt-6 text-center">
                <span className="text-gray-400">Don&apos;t have an account? </span>
                <Link href="/register" className="text-green-600 hover:text-green-700 font-semibold">Create one</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right - Benefits */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 relative overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-emerald-300/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center justify-center w-full px-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">The Marketplace for Developers</h2>
            <p className="text-green-100 text-lg mb-8 leading-relaxed">
              Buy and sell premium code. Scripts, templates, themes, and plugins.
            </p>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 hover:bg-white/15 transition-all">
                  <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                    <benefit.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                    <p className="text-sm text-green-100">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-green-600" /></div>}>
      <LoginFormContent />
    </Suspense>
  )
}
