import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { Nav } from '@/components/nav'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'CarTrack | Car Search Dashboard',
  description:
    'Track and compare car listings from AutoTrader, Motors, Gumtree, and eBay. Get alerts on price drops and new listings matching your saved searches.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <Nav />
        <main className="flex-1">{children}</main>
        <Toaster />
      </body>
    </html>
  )
}
