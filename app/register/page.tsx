'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    // 1. Mendaftar ke Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Data tambahan (metadata) disimpan di sini
        data: {
          full_name: fullName, 
        },
      },
    })

    if (error) {
      setMsg('Error: ' + error.message)
      setLoading(false)
      return
    }

    // 2. Cek apakah auto-login berhasil atau butuh verifikasi email
    if (data.session) {
      alert('Registrasi Berhasil! Anda akan diarahkan ke halaman utama.')
      router.push('/')
      router.refresh()
    } else {
      // Jika settingan Supabase butuh verifikasi email
      setMsg('Registrasi berhasil! Silakan cek email Anda untuk verifikasi sebelum login.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Daftar Akun Baru</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">Sistem POS</p>
        
        {msg && (
          <div className={`mb-4 p-3 rounded text-sm ${msg.includes('Error') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
            {msg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input 
              type="text" 
              placeholder="Contoh: Budi Kasir" 
              className="w-full border p-3 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={fullName} onChange={e => setFullName(e.target.value)} required
            />
          </div>

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
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Memproses...' : 'Daftar Sekarang'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Sudah punya akun? <Link href="/login" className="text-blue-600 font-bold hover:underline">Login disini</Link>
        </div>
      </div>
    </div>
  )
}