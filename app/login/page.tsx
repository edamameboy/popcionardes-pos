'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link' // <--- Jangan lupa import ini

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Login POS</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">Masuk untuk memulai penjualan</p>
        
        {errorMsg && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="email@toko.com" 
              className="w-full border p-3 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email} onChange={e => setEmail(e.target.value)} required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="******" 
              className="w-full border p-3 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password} onChange={e => setPassword(e.target.value)} required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-pop-green text-white p-3 rounded-lg font-bold hover:bg-pop-green-dark transition disabled:bg-gray-400"
          >
            {loading ? 'Sedang Masuk...' : 'Masuk'}
          </button>
        </form>

        {/* --- TOMBOL KE HALAMAN REGISTER --- */}
        <div className="mt-6 text-center text-sm text-gray-600 border-t pt-4">
          Belum punya akun? <br/>
          <Link href="/register" className="text-green-600 font-bold hover:underline text-base">
            Daftar Akun Baru
          </Link>
        </div>

      </div>
    </div>
  )
}