'use client'

import { useEffect } from 'react'
import { installCsrfInterceptor } from '@/lib/security/client'

let installed = false

export function CsrfProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!installed) {
      installCsrfInterceptor()
      installed = true
    }
  }, [])

  return <>{children}</>
}
