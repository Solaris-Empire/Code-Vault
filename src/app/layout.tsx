import type { Metadata } from 'next'
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { CsrfProvider } from '@/components/csrf-provider'
import { getBetaFlagsForClient } from '@/lib/feature-flags'
import './globals.css'

// Force per-request rendering so getBetaFlagsForClient() picks up
// live FEATURE_* env vars. Without this, Next.js can statically
// prerender the root layout and bake in a stale flag snapshot,
// which hides Hire/Jobs/Community nav even after flags are flipped.
export const dynamic = 'force-dynamic'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CodeVault — Premium Digital Code Marketplace',
    template: '%s | CodeVault',
  },
  description:
    'Buy and sell premium code, scripts, themes, and templates. The marketplace for developers by developers.',
  keywords: [
    'code marketplace',
    'buy scripts',
    'sell code',
    'web templates',
    'WordPress themes',
    'React components',
    'digital downloads',
  ],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const betaFlags = getBetaFlagsForClient()
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <CsrfProvider>
          <AnnouncementBar />
          <Header betaFlags={betaFlags} />
          <main id="main-content">{children}</main>
          <Footer />
        </CsrfProvider>
      </body>
    </html>
  )
}
