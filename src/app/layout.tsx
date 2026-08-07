import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'YipEng Dashboard',
  description: 'Booking analytics and management dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
