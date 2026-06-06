'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { User, LogOut, Moon, Sun, MonitorSmartphone, ShieldCheck, Store, Database, Trash2, ChevronRight, Package, ShoppingCart, Users, Download } from 'lucide-react'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  
  // STATE UNTUK PWA INSTALL
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    fetchUser()

    // LISENER UNTUK PWA INSTALL PROMPT
    const handleBeforeInstallPrompt = (e: Event) => {
      // Mencegah prompt bawaan browser muncul otomatis
      e.preventDefault()
      // Simpan event agar bisa dipicu oleh tombol kita nanti
      setDeferredPrompt(e)
      // Tampilkan tombol Install di UI
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      // Sembunyikan tombol jika sudah berhasil diinstal
      setIsInstallable(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    } else {
      router.push('/login')
    }
    setLoading(false)
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error("Instalasi tidak didukung atau sudah diinstal.")
      return
    }
    
    // Munculkan popup instalasi bawaan sistem/browser
    deferredPrompt.prompt()
    
    // Tunggu pilihan user (Install atau Batal)
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      toast.success("Mulai menginstal aplikasi...")
    }
    
    // Reset state setelah prompt digunakan
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  const handleLogout = async () => {
    const loadingToast = toast.loading('Sedang keluar...')
    await supabase.auth.signOut()
    toast.dismiss(loadingToast)
    router.push('/login')
  }

  const handleClearCache = () => {
    if (confirm('Bersihkan data cache lokal? (Hanya menghapus data sementara, tidak menghapus data di server utama)')) {
        const req = indexedDB.deleteDatabase('pos-offline-db')
        req.onsuccess = () => toast.success("Cache berhasil dibersihkan!")
        req.onerror = () => toast.error("Gagal membersihkan cache")
    }
  }

  const getRoleDisplay = () => {
      const role = profile?.role
      if (role === 'admin') {
          return { label: 'Administrator', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800', icon: ShieldCheck }
      } else if (role === 'gudang') {
          return { label: 'Staf Gudang', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800', icon: Package }
      } else {
          return { label: 'Kasir', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800', icon: ShoppingCart }
      }
  }

  if (loading) return <div className="p-4 text-center dark:text-white mt-10">Memuat profil...</div>

  const RoleData = getRoleDisplay()
  const RoleIcon = RoleData.icon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 transition-colors duration-300 select-none">
      
      {/* HEADER PROFILE */}
      <div className="bg-white dark:bg-slate-800 pt-12 pb-6 px-4 shadow-sm border-b dark:border-slate-700 flex flex-col items-center transition-colors">
        <div className="w-24 h-24 bg-gradient-to-tr from-pop-green to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-none mb-3">
          <User size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white transition-colors">
            {profile?.full_name || user?.email?.split('@')[0] || 'Pengguna'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-3 transition-colors">{user?.email}</p>
        
        {/* BADGE ROLE DINAMIS */}
        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${RoleData.color}`}>
            <RoleIcon size={14}/>
            {RoleData.label}
        </div>
      </div>

      <div className="p-4 space-y-6 mt-2">
        
        {/* SECTION: TAMPILAN */}
        <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">Tampilan Aplikasi</h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
                <button onClick={() => {setTheme('light'); toast.success("Mode Terang aktif")}} className="w-full flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-lg"><Sun size={18}/></div>
                        <span className="font-medium text-gray-700 dark:text-gray-200">Mode Terang</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${theme === 'light' ? 'border-pop-green' : 'border-gray-300 dark:border-slate-600'}`}>
                        {theme === 'light' && <div className="w-2.5 h-2.5 bg-pop-green rounded-full"></div>}
                    </div>
                </button>

                <button onClick={() => {setTheme('dark'); toast.success("Mode Gelap aktif")}} className="w-full flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-lg"><Moon size={18}/></div>
                        <span className="font-medium text-gray-700 dark:text-gray-200">Mode Gelap</span>
                    </div>
                    
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${theme === 'dark' ? 'border-pop-green' : 'border-gray-300 dark:border-slate-600'}`}>
                        {theme === 'dark' && <div className="w-2.5 h-2.5 bg-pop-green rounded-full"></div>}
                    </div>
                </button>

                <button onClick={() => {setTheme('system'); toast.success("Tema mengikuti sistem HP")}} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><MonitorSmartphone size={18}/></div>
                        <span className="font-medium text-gray-700 dark:text-gray-200">Ikuti Sistem HP</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${theme === 'system' ? 'border-pop-green' : 'border-gray-300 dark:border-slate-600'}`}>
                        {theme === 'system' && <div className="w-2.5 h-2.5 bg-pop-green rounded-full"></div>}
                    </div>
                </button>
            </div>
        </div>

        {/* SECTION: PENGATURAN TOKO (HANYA ADMIN) */}
        {profile?.role === 'admin' && (
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">Pengaturan Admin</h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
                    
                    <button onClick={() => router.push('/profile/users')} className="w-full flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><Users size={18}/></div>
                            <span className="font-medium text-gray-700 dark:text-gray-200">Manajemen Pengguna</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400"/>
                    </button>

                    <button onClick={() => router.push('/profile/store')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg"><Store size={18}/></div>
                            <span className="font-medium text-gray-700 dark:text-gray-200">Informasi Toko & Struk</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400"/>
                    </button>
                </div>
            </div>
        )}

        {/* SECTION: SISTEM */}
        <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2">Sistem</h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
                
                {/* TOMBOL INSTALL PWA (Hanya muncul jika belum diinstal & browser mendukung) */}
                {isInstallable && (
                    <button onClick={handleInstallClick} className="w-full flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg"><Download size={18}/></div>
                            <div className="text-left">
                                <div className="font-medium text-gray-700 dark:text-gray-200">Install ke Home Screen</div>
                                <div className="text-[10px] text-gray-400">Jadikan aplikasi native di HP Anda</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400"/>
                    </button>
                )}

                <button onClick={handleClearCache} className="w-full flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg"><Database size={18}/></div>
                        <div className="text-left">
                            <div className="font-medium text-gray-700 dark:text-gray-200">Bersihkan Cache</div>
                            <div className="text-[10px] text-gray-400">Kosongkan memori HP untuk aplikasi ini</div>
                        </div>
                    </div>
                    <Trash2 size={18} className="text-gray-400"/>
                </button>
                
                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors"><LogOut size={18}/></div>
                    <span className="font-bold text-red-600">Keluar Akun (Logout)</span>
                </button>
            </div>
        </div>

        <div className="text-center text-xs text-gray-400 pb-8">
            Popcionardes POS v2.1.0<br/>Sistem Kasir Offline-First
        </div>
      </div>
    </div>
  )
}