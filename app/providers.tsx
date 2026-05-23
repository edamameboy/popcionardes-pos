'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#334155', // Warna soft dark
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      {children}
    </ThemeProvider>
  )
}