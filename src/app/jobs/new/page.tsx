// /jobs/new — post a job listing.
// Auth-gated; the form itself is a client island.

import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import PostJobForm from './post-job-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Post a Job · CodeVault' }

export default async function PostJobPage() {
  requireBetaFeature('jobs')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/jobs/new')

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to jobs
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Post a tech job</h1>
        <p className="text-(--color-text-secondary) mt-2 text-sm max-w-2xl">
          Listings stay live for 30 days. Applicants apply with their
          CodeVault profile — rank, shipped projects, and reviews come
          attached automatically.
        </p>
        <div className="mt-6">
          <PostJobForm />
        </div>
      </div>
    </div>
  )
}
