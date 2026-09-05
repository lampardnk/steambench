import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'steambench',
  description: 'hi from steambench.',
  applicationName: 'steambench',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fafafa',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} light bg-background`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
