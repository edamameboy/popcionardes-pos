'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Calendar, CreditCard, ChevronDown, ChevronUp, Trash2, X, Tag, Gift, User } from 'lucide-react'

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  
  // STATE BARU: Untuk kontrol tombol hapus
  const [isAdmin, setIsAdmin] = useState(false) 

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    initPage()
  }, [])

  const initPage = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    // 1. Cek Role (Tapi JANGAN ditendang kalau bukan admin)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      setIsAdmin(true) // Aktifkan mode admin
    }

    // 2. Ambil data (Semua user boleh fetch karena Policy SQL sudah 'SELECT true')
    await Promise.all([fetchTransactions(), fetchProfiles()])
    setLoading(false)
  }

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name')
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((p: any) => { map[p.id] = p.full_name || 'Tanpa Nama' })
      setUsersMap(map)
    }
  }

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items ( quantity, price_at_purchase, products ( name ) )
      `)
      .order('created_at', { ascending: false })

    if (data) setTransactions(data)
  }

  const deleteTransaction = async (id: string) => {
    if(!confirm('Hapus transaksi ini? Stok tidak akan kembali otomatis.')) return
    
    // Keamanan Ganda: Cek di frontend, nanti di backend juga ditolak SQL Policy
    if (!isAdmin) {
        alert("Akses Ditolak: Hanya Admin yang boleh menghapus.")
        return
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id)
    
    if (error) {
        alert("Gagal menghapus! " + error.message)
    } else {
        fetchTransactions()
    }
  }

  const getImgUrl = (path: string) => 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pos-images/${path}`

  if (loading) return <div className="p-4 text-center dark:text-white">Memuat data...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-24 transition-colors">
      <h1 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Riwayat Transaksi</h1>

      <div className="space-y-4">
        {transactions.map((t) => {
          const subtotal = t.transaction_items.reduce((acc: number, item: any) => acc + (item.price_at_purchase * item.quantity), 0)
          const hasDiscount = t.discount_value > 0
          const hasFreeItems = t.transaction_items.some((item: any) => item.price_at_purchase === 0)
          const cashierName = usersMap[t.user_id] || 'Kasir Lama/Terhapus'

          return (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
              
              {/* Header Card (Klik untuk expand) */}
              <div 
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12}/> {new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <User size={12}/> {cashierName}
                    </span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">
                      Rp {t.total_amount.toLocaleString()}
                    </h3>
                  </div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                     <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <CreditCard size={10}/> {t.payment_method}
                     </span>
                     {hasDiscount && (
                       <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <Tag size={10}/> Diskon
                       </span>
                     )}
                     {hasFreeItems && (
                       <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                          <Gift size={10}/> BONUS
                       </span>
                     )}
                  </div>
                </div>
                <div className="pl-2">
                  {expandedId === t.id ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
                </div>
              </div>

              {/* Detail Transaksi */}
              {expandedId === t.id && (
                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 border-t border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Item Dibeli</h4>
                  <div className="space-y-2 mb-4 border-b dark:border-slate-700 pb-3">
                    {t.transaction_items.map((item: any, idx: number) => {
                      const isFree = item.price_at_purchase === 0;
                      return (
                        <div key={idx} className={`flex justify-between text-sm p-2 rounded ${isFree ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30' : ''}`}>
                          <div className="flex flex-col">
                            <span className="dark:text-gray-200 font-medium">
                              {item.products?.name} <span className="text-gray-400 font-normal">x{item.quantity}</span>
                            </span>
                            {isFree && <span className="text-[10px] text-green-600 font-bold mt-0.5">BONUS / GRATIS</span>}
                          </div>
                          <span className={`font-medium ${isFree ? 'text-green-600' : 'dark:text-gray-200'}`}>
                            {isFree ? 'Rp 0' : `Rp ${(item.price_at_purchase * item.quantity).toLocaleString()}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-1 mb-4 text-sm dark:text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>Rp {subtotal.toLocaleString()}</span>
                    </div>
                    {hasDiscount && (
                      <div className="flex justify-between text-red-500">
                        <span>Diskon</span>
                        <span>- Rp {(subtotal - t.total_amount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t dark:border-slate-700 mt-2">
                      <span>Total Bayar</span>
                      <span>Rp {t.total_amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {t.proof_images && t.proof_images.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Bukti Foto</h4>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {t.proof_images.map((img: string, i: number) => (
                          <div key={i} onClick={() => setPreviewImage(getImgUrl(img))} className="relative w-20 h-20 flex-shrink-0 cursor-pointer">
                             <img src={getImgUrl(img)} className="w-full h-full object-cover rounded-lg border dark:border-slate-600"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TOMBOL HAPUS: HANYA MUNCUL JIKA ADMIN */}
                  {isAdmin && (
                    <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-slate-700">
                       <button 
                         onClick={() => deleteTransaction(t.id)}
                         className="flex items-center gap-2 text-red-600 text-sm font-bold bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 px-3 py-2 rounded-lg hover:bg-red-50"
                       >
                         <Trash2 size={16}/> Hapus Data
                       </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-white/10 text-white p-2 rounded-full"><X size={24} /></button>
          <img src={previewImage} alt="Full" className="max-w-full max-h-[85vh] object-contain rounded-lg"/>
        </div>
      )}
    </div>
  )
}