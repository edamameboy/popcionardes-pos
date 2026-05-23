'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, MapPin, Phone, MessageSquare, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StoreSettings() {
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // State Form
  const [storeName, setStoreName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [footerLine1, setFooterLine1] = useState('')
  const [footerLine2, setFooterLine2] = useState('')

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
        toast.error("Akses Ditolak: Hanya Admin yang dapat mengakses menu ini.")
        return router.push('/profile')
    }
    
    setIsAdmin(true)
    fetchStoreSettings()
  }

  const fetchStoreSettings = async () => {
    const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single()
    if (error) {
        toast.error("Gagal memuat pengaturan toko.")
    } else if (data) {
        setStoreName(data.name)
        setAddress(data.address || '')
        setPhone(data.phone || '')
        setFooterLine1(data.footer_line1 || '')
        setFooterLine2(data.footer_line2 || '')
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const { error } = await supabase.from('store_settings').update({
        name: storeName,
        address: address,
        phone: phone,
        footer_line1: footerLine1,
        footer_line2: footerLine2,
        updated_at: new Date().toISOString()
    }).eq('id', 1)

    if (error) {
        toast.error("Gagal memperbarui data: " + error.message)
    } else {
        toast.success("Pengaturan Toko & Struk berhasil disimpan!")
        router.push('/profile')
    }
    setIsSaving(false)
  }

  if (loading) return <div className="p-4 text-center dark:text-white mt-10">Memuat konfigurasi...</div>
  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 transition-colors duration-300 select-none">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-30 shadow-sm flex items-center gap-3 transition-colors">
        <button onClick={() => router.push('/profile')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-600 dark:text-white transition-colors">
            <ArrowLeft size={24} />
        </button>
        <div>
            <h1 className="font-bold text-lg text-gray-800 dark:text-white">Pengaturan Toko & Struk</h1>
            <p className="text-[10px] text-gray-500">Sesuaikan informasi identitas nota fisik/digital</p>
        </div>
      </div>

      {/* FORM */}
      <div className="p-4 max-w-sm mx-auto">
        <form onSubmit={handleSave} className="space-y-5">
            
            {/* Informasi Utama */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4 transition-colors">
                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider">Identitas Utama</h3>
                
                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nama Toko / Bisnis</label>
                    <div className="relative mt-1">
                        <Store size={18} className="absolute left-3 top-3.5 text-gray-400" />
                        <input type="text" className="w-full border pl-10 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold outline-none focus:ring-2 focus:ring-pop-green" value={storeName} onChange={e => setStoreName(e.target.value)} required />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Alamat Cabang / Lokasi Utama</label>
                    <div className="relative mt-1">
                        <MapPin size={18} className="absolute left-3 top-3.5 text-gray-400" />
                        <input type="text" className="w-full border pl-10 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm outline-none focus:ring-2 focus:ring-pop-green" value={address} onChange={e => setAddress(e.target.value)} required />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nomor Kontak Toko</label>
                    <div className="relative mt-1">
                        <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" />
                        <input type="text" className="w-full border pl-10 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm outline-none focus:ring-2 focus:ring-pop-green" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Konfigurasi Kaki Struk (Footer) */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4 transition-colors">
                <h3 className="text-xs font-bold text-purple-500 uppercase tracking-wider">Bagian Bawah Struk (Footer)</h3>
                
                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Baris Pesan 1 (Besar)</label>
                    <div className="relative mt-1">
                        <MessageSquare size={18} className="absolute left-3 top-3.5 text-gray-400" />
                        <input type="text" className="w-full border pl-10 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-pop-green" value={footerLine1} onChange={e => setFooterLine1(e.target.value)} placeholder="TERIMA KASIH" required />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Baris Pesan 2 (Kecil)</label>
                    <div className="relative mt-1">
                        <MessageSquare size={18} className="absolute left-3 top-3.5 text-gray-400" />
                        <input type="text" className="w-full border pl-10 p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs outline-none focus:ring-2 focus:ring-pop-green" value={footerLine2} onChange={e => setFooterLine2(e.target.value)} placeholder="Struk ini adalah bukti resmi" />
                    </div>
                </div>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-pop-green hover:bg-pop-green-dark text-white py-3.5 rounded-xl font-bold text-base shadow-lg shadow-green-500/20 flex justify-center items-center gap-2 transition-all disabled:bg-gray-400">
                <Save size={20}/>
                {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
            </button>

        </form>
      </div>
    </div>
  )
}