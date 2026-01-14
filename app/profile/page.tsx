'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, UserCircle, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  
  // Ambil resolvedTheme untuk tahu tema yang AKTIF saat ini (meskipun settingannya 'system')
  const { theme, setTheme, resolvedTheme } = useTheme() 
  const [mounted, setMounted] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) setUser(data.user)
      else router.push('/login')
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Toggle function: Cek tema yang aktif sekarang, lalu balik kondisinya
  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 transition-colors duration-300">
      <h1 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">Profil Saya</h1>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center mb-6 transition-colors">
        <div className="w-24 h-24 bg-pop-green-light dark:bg-slate-700 rounded-full flex items-center justify-center text-pop-green dark:text-pop-green mb-4 shadow-sm border-4 border-white dark:border-slate-800">
            <UserCircle size={64} />
        </div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {user?.user_metadata?.full_name || 'Kasir'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{user?.email}</p>
      </div>

      <div className="space-y-3">
        {/* Tombol Toggle Tema */}
        <button 
          onClick={toggleTheme}
          className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 p-4 rounded-xl flex items-center justify-between font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
        >
          <div className="flex items-center gap-3">
            {/* Icon berubah sesuai tema yang aktif */}
            {resolvedTheme === 'dark' ? <Moon size={20} className="text-purple-400"/> : <Sun size={20} className="text-orange-500"/>}
            <span>Mode Tampilan</span>
          </div>
          <span className="text-xs bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded text-gray-500 dark:text-gray-400">
            {resolvedTheme === 'dark' ? 'Gelap (Night)' : 'Terang (Day)'}
          </span>
        </button>

        <button 
          onClick={handleLogout}
          className="w-full bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 font-semibold hover:bg-red-50 dark:hover:bg-red-900/10 transition"
        >
          <LogOut size={20} />
          Keluar Aplikasi
        </button>
      </div>
      
      <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-8">Versi Aplikasi 1.0.1</p>
    </div>
  )
}