'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, ShieldCheck, ShoppingCart, Package } from 'lucide-react'
import toast from 'react-hot-toast'

export default function UserManagement() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAdminAndFetchUsers()
  }, [])

  const checkAdminAndFetchUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    setCurrentUserId(user.id)

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
        toast.error("Akses Ditolak: Hanya Admin.")
        return router.push('/profile')
    }
    
    setIsAdmin(true)
    fetchUsers()
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) {
        // Menampilkan pesan error asli dari Supabase agar mudah dilacak
        toast.error("Gagal memuat: " + error.message)
        console.error("Error Detail:", error)
    } 
    
    if (data) {
        // Kita urutkan namanya secara manual pakai JavaScript saja biar aman
        const sortedData = data.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
        setUsers(sortedData)
    }
    setLoading(false)
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    const loadToast = toast.loading('Mengubah hak akses...')
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    
    if (error) {
        toast.error("Gagal mengubah role: " + error.message, { id: loadToast })
    } else {
        toast.success("Hak akses berhasil diperbarui!", { id: loadToast })
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  const getRoleIcon = (role: string) => {
      if (role === 'admin') return <ShieldCheck size={16} className="text-purple-500"/>
      if (role === 'gudang') return <Package size={16} className="text-orange-500"/>
      return <ShoppingCart size={16} className="text-blue-500"/>
  }

  if (loading) return <div className="p-4 text-center dark:text-white mt-10">Memuat data pengguna...</div>
  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 transition-colors duration-300 select-none">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-30 shadow-sm flex items-center gap-3 transition-colors">
        <button onClick={() => router.push('/profile')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-600 dark:text-white transition-colors">
            <ArrowLeft size={24} />
        </button>
        <div>
            <h1 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-pop-green"/> Manajemen Pengguna
            </h1>
            <p className="text-[10px] text-gray-500">Atur hak akses staf toko Anda</p>
        </div>
      </div>

      {/* DAFTAR PENGGUNA */}
      <div className="p-4 max-w-lg mx-auto space-y-3">
         {users.map((userItem) => (
             <div key={userItem.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-gray-500 dark:text-gray-300">
                         {userItem.full_name ? userItem.full_name.charAt(0).toUpperCase() : 'U'}
                     </div>
                     <div>
                         <div className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                             {userItem.full_name || 'Tanpa Nama'}
                             {userItem.id === currentUserId && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase">Anda</span>}
                         </div>
                         <div className="text-xs text-gray-500 mt-0.5">{userItem.id.substring(0, 8)}...</div>
                     </div>
                 </div>

                 <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 p-1.5 rounded-xl border dark:border-slate-700 w-full sm:w-auto">
                     <div className="pl-2 pr-1">{getRoleIcon(userItem.role)}</div>
                     <select 
                        className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 outline-none w-full sm:w-auto cursor-pointer"
                        value={userItem.role || 'kasir'}
                        onChange={(e) => handleRoleChange(userItem.id, e.target.value)}
                        disabled={userItem.id === currentUserId} // Mencegah Admin mencopot dirinya sendiri
                     >
                         <option value="kasir" className="text-black">Kasir (Transaksi)</option>
                         <option value="gudang" className="text-black">Gudang (Opname)</option>
                         <option value="admin" className="text-black">Administrator (Akses Penuh)</option>
                     </select>
                 </div>
             </div>
         ))}
      </div>
    </div>
  )
}