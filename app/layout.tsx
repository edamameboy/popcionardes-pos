import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import OfflineSync from '@/components/OfflineSync'
import { Providers } from './providers' // IMPORT PROVIDER BARU

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Popcionardes POS',
  description: 'Offline-First POS System',
  manifest: '/manifest.json',
  themeColor: '#00a651',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Popcionardes',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // SUPPRESS HYDRATION WARNING PENTING UNTUK NEXT-THEMES
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-900 transition-colors duration-300 ease-in-out antialiased`}>
        <Providers>
          <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 min-h-screen shadow-2xl relative overflow-hidden transition-colors duration-300">
            {children}
            <OfflineSync />
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  )
}