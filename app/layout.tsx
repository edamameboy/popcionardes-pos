import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import BottomNav from '@/components/BottomNav' // <-- Import ini
import OfflineSync from '@/components/OfflineSync'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Popcionardes POS',
  description: 'Aplikasi Kasir POPCionardes',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon.ico',
  },
  // Tambahkan ini sebagai cadangan:
  other: {
    "mobile-web-app-capable": "yes",
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* PINDAHKAN KELAS CSS DARI globals.css KE SINI: */}
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <OfflineSync />
        <Providers>
          <main className="pb-20">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}