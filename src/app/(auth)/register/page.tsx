'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, Loader2, Code2, Zap, Shield, Download, Mail, Lock, User,
  ArrowRight, CheckCircle2, Check, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { SocialLoginButtons } from '@/components/auth/social-login-buttons'

const registerSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })

type RegisterForm = z.infer<typeof registerSchema>

const benefits = [
  { icon: Download, title: 'Instant Downloads', description: 'Access purchased code immediately' },
  { icon: Zap, title: 'Earn 85%', description: 'Sell code and keep 85% of every sale' },
  { icon: Shield, title: 'License Protection', description: 'Unique license keys for every purchase' },
]

const passwordRequirements = [
  { regex: /.{8,}/, label: 'At least 8 characters' },
  { regex: /[A-Z]/, label: 'One uppercase letter' },
  { regex: /[a-z]/, label: 'One lowercase letter' },
  { regex: /[0-9]/, label: 'One number' },
]

export default function RegisterPage() {
  const { signUp } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password', '')

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null)
      await signUp(data.email, data.password, data.displayName)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <Card className="w-full max-w-md border-gray-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-none flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Check your email</h2>
            <p className="text-gray-400 mb-8">We&apos;ve sent a confirmation link. Please check your email to verify your account.</p>
            <Button asChild className="w-full h-12 btn-primary rounded-none border-0">
              <Link href="/login">Back to Sign In <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Benefits */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 relative overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-none blur-3xl" />
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-emerald-300/20 rounded-none blur-3xl" />
        <div className="relative z-10 flex items-center justify-center w-full px-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Join CodeVault</h2>
            <p className="text-green-100 text-lg mb-8 leading-relaxed">Create an account to buy premium code or start selling and earning.</p>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-none border border-white/15 hover:bg-white/15 transition-all">
                  <div className="w-12 h-12 bg-white/15 rounded-none flex items-center justify-center shrink-0">
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

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 bg-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <Code2 className="h-10 w-10 text-green-600" />
              <span className="text-2xl font-bold text-gray-900 tracking-tight">CodeVault</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Create an account</h1>
            <p className="text-gray-400">Join the marketplace for developers</p>
          </div>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {error && <div className="p-4 rounded-none bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}

                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-gray-700">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                    <Input id="displayName" type="text" placeholder="Your name"
                      className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-200 rounded-none"
                      {...register('displayName')} />
                  </div>
                  {errors.displayName && <p className="text-sm text-red-500">{errors.displayName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                    <Input id="email" type="email" placeholder="you@example.com"
                      className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-200 rounded-none"
                      {...register('email')} />
                  </div>
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password"
                      className="pl-10 pr-10 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-200 rounded-none"
                      {...register('password')} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {password && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {passwordRequirements.map((req, index) => {
                        const isValid = req.regex.test(password)
                        return (
                          <div key={index} className={`flex items-center gap-1.5 text-xs ${isValid ? 'text-green-600' : 'text-gray-400'}`}>
                            {isValid ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            {req.label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                    <Input id="confirmPassword" type="password" placeholder="Confirm your password"
                      className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-green-200 rounded-none"
                      {...register('confirmPassword')} />
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                </div>

                <Button type="submit" className="w-full h-12 text-base font-semibold btn-primary rounded-none border-0" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating account...</>) : (<>Create Account <ArrowRight className="ml-2 h-5 w-5" /></>)}
                </Button>
              </form>

              <SocialLoginButtons />

              <div className="mt-6 text-center">
                <span className="text-gray-400">Already have an account? </span>
                <Link href="/login" className="text-green-600 hover:text-green-700 font-semibold">Sign in</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
