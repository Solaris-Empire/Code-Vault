import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CodeVault - Premium Digital Code Marketplace',
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
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-sans antialiased bg-white text-gray-900`}>
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
