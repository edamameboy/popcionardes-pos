'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Calendar, CreditCard, ChevronDown, ChevronUp, Trash2, X, Tag, Gift, User, Edit, Printer, Download, Share2, Search, Filter, RefreshCcw } from 'lucide-react'
import { toPng } from 'html-to-image' 
import jsPDF from 'jspdf'
import { useNetwork } from '@/hooks/useNetwork'
import toast from 'react-hot-toast'

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false) 

  const [editModal, setEditModal] = useState(false)
  const [editData, setEditData] = useState<any>(null)

  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [isSharing, setIsSharing] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const network = useNetwork()

  // --- STATE FILTER & SORTING ---
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [filterEvent, setFilterEvent] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date-desc')

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    initPage()
  }, [])

  const initPage = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'gudang') {
        toast.error('Akses Ditolak: Anda tidak dapat melihat riwayat transaksi.')
        return router.push('/inventory')
    }
    if (profile?.role === 'admin') setIsAdmin(true)

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
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDateString = thirtyDaysAgo.toISOString()

    const { data } = await supabase
      .from('transactions')
      .select(`*, transaction_items ( quantity, price_at_purchase, products ( name ) )`)
      .gte('created_at', startDateString)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (data) setTransactions(data)
  }

  const deleteTransaction = async (id: string) => {
    if(!confirm('Hapus (Void) transaksi ini? Stok tidak akan kembali otomatis.')) return
    if (!isAdmin) return alert("Akses Ditolak: Hanya Admin yang boleh menghapus.")

    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) alert("Gagal menghapus! " + error.message)
    else {
        setTransactions(prev => prev.filter(t => t.id !== id))
        toast.success("Transaksi berhasil divoid/dihapus")
    }
  }

  // ==========================================
  // LOGIKA EDIT TRANSAKSI DIPERBARUI
  // ==========================================
  const handleEdit = (t: any) => {
    // Ubah format waktu UTC dari database ke format lokal YYYY-MM-DDTHH:mm 
    // agar bisa dibaca oleh input kalender HTML (datetime-local)
    const dateObj = new Date(t.created_at)
    const localDateTime = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

    setEditData({ 
        id: t.id, 
        payment_method: t.payment_method, 
        note: t.note || '', 
        location_event: t.location_event || '', 
        customer_name: t.customer_name || '', 
        customer_phone: t.customer_phone || '',
        created_at: localDateTime // Masukkan tanggal ke state edit
    })
    setEditModal(true)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Kembalikan waktu ke format standar ISO sebelum dikirim ke database
    const updatedDateISO = new Date(editData.created_at).toISOString()

    const { error } = await supabase.from('transactions').update({
        payment_method: editData.payment_method, 
        note: editData.note, 
        location_event: editData.location_event, 
        customer_name: editData.customer_name, 
        customer_phone: editData.customer_phone,
        created_at: updatedDateISO // Kirim update tanggal ke database
    }).eq('id', editData.id)

    if(error) {
        toast.error("Gagal update: " + error.message)
    } else {
        // Update state lokal tanpa harus refresh halaman
        setTransactions(prev => prev.map(t => t.id === editData.id ? { 
            ...t, 
            ...editData,
            created_at: updatedDateISO // Sinkronisasi tanggal di UI
        } : t))
        setEditModal(false)
        toast.success("Data transaksi berhasil diperbarui!")
    }
  }
  // ==========================================

  const openReceipt = (t: any) => {
    const subtotal = t.transaction_items.reduce((acc: number, item: any) => acc + (item.price_at_purchase * item.quantity), 0)
    const timeMillis = new Date(t.created_at).getTime().toString()
    const notaId = `TR-${timeMillis.slice(-8)}`
    
    setReceiptData({
        notaId: notaId, date: new Date(t.created_at).toLocaleString('id-ID'), cashier: usersMap[t.user_id] || 'Kasir', event: t.location_event || 'Umum/Toko',
        customerName: t.customer_name || 'Pelanggan Umum', customerPhone: t.customer_phone || '-',
        items: t.transaction_items.map((i:any) => ({ name: i.products?.name || 'Produk Dihapus', price: i.price_at_purchase, quantity: i.quantity })),
        subtotal, discountAmount: t.discount_type === 'percent' ? (subtotal * t.discount_value / 100) : t.discount_value, total: t.total_amount, paymentMethod: t.payment_method, note: t.note || ''
    })
    setShowReceipt(true)
  }

  const generatePDFBlob = async () => {
    if (!receiptRef.current) return null
    try {
        await toPng(receiptRef.current, { cacheBust: true, backgroundColor: '#ffffff' })
        await new Promise(res => setTimeout(res, 100))
        const imgData = await toPng(receiptRef.current, { quality: 0.7, pixelRatio: 1.5, cacheBust: true, backgroundColor: '#ffffff', style: { margin: '0', transform: 'scale(1)' } })
        const pdfWidth = 80 
        const canvasWidth = receiptRef.current.offsetWidth
        const canvasHeight = receiptRef.current.offsetHeight
        const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth
        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]) 
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
        return pdf
    } catch (error) { return null }
  }

  const downloadPDF = async () => { const pdf = await generatePDFBlob(); if (pdf) pdf.save(`Struk_${receiptData.notaId}.pdf`) }

  const shareReceiptLink = async () => {
    if (!network.online) return alert("Offline. Silakan gunakan tombol Download PDF.")
    setIsSharing(true)
    try {
        const pdf = await generatePDFBlob(); if (!pdf) throw new Error("Gagal render")
        const pdfBlob = pdf.output('blob'); const file = new File([pdfBlob], `Struk_${receiptData.notaId}.pdf`, { type: 'application/pdf' })
        const filePath = `receipts/${receiptData.notaId}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage.from('pos-images').upload(filePath, file, { contentType: 'application/pdf' })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('pos-images').getPublicUrl(filePath)
        const receiptUrl = data?.publicUrl; if (!receiptUrl) throw new Error("Gagal link")
        const textToShare = `Halo Kak *${receiptData.customerName}*,\nTerima kasih telah berbelanja di *POPCIONARDES*.\n\nTotal Belanja: *Rp ${receiptData.total.toLocaleString()}*\nNo Nota: ${receiptData.notaId}\n\nBerikut link struk Anda:\n${receiptUrl}`
        setIsSharing(false) 
        if (navigator.share) await navigator.share({ title: `Struk - ${receiptData.notaId}`, text: textToShare })
        else { await navigator.clipboard.writeText(textToShare); alert("Link tersalin ke clipboard.") }
    } catch (error: any) { setIsSharing(false); if (error.name !== 'AbortError') alert("Gagal membagikan link struk.") }
  }

  const getImgUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pos-images/${path}`

  const uniqueEvents = Array.from(new Set(transactions.map(t => t.location_event || 'Umum/Toko')))

  const processedData = useMemo(() => {
    let result = [...transactions]

    if (search) {
        const s = search.toLowerCase()
        result = result.filter(t => {
            // 1. Cek apakah ada di dalam nama produk (Perbaikan: menggunakan transaction_items dan products?.name)
            const matchProduct = t.transaction_items?.some((item: any) => 
                (item.products?.name || '').toLowerCase().includes(s)
            )
            
            // 2. Cek apakah ada di catatan (note)
            const matchNote = (t.note?.toLowerCase() || '').includes(s)
            
            // 3. Cek apakah ada di nama pelanggan (customer_name)
            const matchCustomer = (t.customer_name?.toLowerCase() || '').includes(s)

            // Jika salah satu dari ketiga di atas cocok, maka tampilkan transaksinya!
            return matchProduct || matchNote || matchCustomer
        })
    }

    if (filterEvent) result = result.filter(t => (t.location_event || 'Umum/Toko') === filterEvent)
    if (filterPayment) result = result.filter(t => t.payment_method === filterPayment)
    if (dateFrom) result = result.filter(t => new Date(t.created_at) >= new Date(dateFrom + 'T00:00:00'))
    if (dateTo) result = result.filter(t => new Date(t.created_at) <= new Date(dateTo + 'T23:59:59'))

    result.sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        if (sortBy === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        if (sortBy === 'amount-desc') return b.total_amount - a.total_amount
        if (sortBy === 'amount-asc') return a.total_amount - b.total_amount
        return 0
    })

    return result
  }, [transactions, search, filterEvent, filterPayment, dateFrom, dateTo, sortBy])

  const filteredTotalAmount = processedData.reduce((sum, t) => sum + t.total_amount, 0)
  const resetFilters = () => { setSearch(''); setFilterEvent(''); setFilterPayment(''); setDateFrom(''); setDateTo(''); setSortBy('date-desc'); }

  if (loading) return <div className="p-4 text-center dark:text-white">Memuat data...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-24 transition-colors select-none">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Riwayat Transaksi</h1>
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`p-2 rounded-xl border flex items-center gap-2 text-sm font-medium transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'}`}
          >
              <Filter size={18} /> {showFilters ? 'Tutup Filter' : 'Filter'}
          </button>
      </div>

      {/* PANEL FILTER */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-[600px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700 space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input 
                        type="text" placeholder="Cari Nama Produk atau Catatan..." 
                        className="w-full pl-9 p-2.5 rounded-xl border text-sm dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={search} onChange={e => setSearch(e.target.value)}
                      />
                  </div>
                  <select 
                    className="border p-2.5 rounded-xl text-sm bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500 md:w-48"
                    value={sortBy} onChange={e => setSortBy(e.target.value)}
                  >
                      <option value="date-desc">Paling Baru</option>
                      <option value="date-asc">Paling Lama</option>
                      <option value="amount-desc">Nominal Tertinggi</option>
                      <option value="amount-asc">Nominal Terendah</option>
                  </select>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Event / Lokasi</label>
                      <select className="w-full border p-2.5 rounded-xl text-sm bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none mt-1" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                          <option value="">Semua Event</option>
                          {uniqueEvents.map((evt, idx) => <option key={idx} value={evt as string}>{evt as string}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Pembayaran</label>
                      <select className="w-full border p-2.5 rounded-xl text-sm bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none mt-1" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                          <option value="">Semua Metode</option>
                          <option value="cash">Cash</option><option value="transfer">Transfer</option><option value="split">Split</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Dari Tanggal</label>
                      <input type="date" className="w-full border p-2 rounded-xl text-sm bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none mt-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Sampai Tanggal</label>
                      <input type="date" className="w-full border p-2 rounded-xl text-sm bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none mt-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
              </div>
              <div className="flex justify-end pt-2 border-t dark:border-slate-700 mt-2">
                  <button onClick={resetFilters} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
                      <RefreshCcw size={14}/> Reset Filter
                  </button>
              </div>
          </div>
      </div>

      <div className="flex justify-between items-center mb-4 px-1">
          <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
              Menampilkan {processedData.length} Transaksi
          </div>
          <div className="text-sm font-bold text-pop-green dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-lg border border-green-100 dark:border-green-900/50">
              Total: Rp {filteredTotalAmount.toLocaleString()}
          </div>
      </div>

      {/* DAFTAR TRANSAKSI KARTU */}
      <div className="space-y-4">
        {processedData.length === 0 ? (
            <div className="text-center text-gray-400 py-10 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">Tidak ada transaksi yang sesuai dengan filter.</div>
        ) : processedData.map((t) => {
          const subtotal = t.transaction_items.reduce((acc: number, item: any) => acc + (item.price_at_purchase * item.quantity), 0)
          const hasDiscount = t.discount_value > 0
          const hasFreeItems = t.transaction_items.some((item: any) => item.price_at_purchase === 0)
          const cashierName = usersMap[t.user_id] || 'Kasir Lama'

          return (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
              <div onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium"><User size={12}/> {cashierName}</span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">Rp {t.total_amount.toLocaleString()}</h3>
                  </div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                     <span className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm uppercase ${t.payment_method === 'split' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}><CreditCard size={10}/> {t.payment_method}</span>
                     {t.location_event && <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded border dark:border-slate-600">{t.location_event}</span>}
                     {hasDiscount && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-2 py-0.5 rounded flex items-center gap-1"><Tag size={10}/> Diskon</span>}
                     {hasFreeItems && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded flex items-center gap-1 font-bold"><Gift size={10}/> BONUS</span>}
                  </div>
                </div>
                <div className="pl-2">{expandedId === t.id ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}</div>
              </div>

              {expandedId === t.id && (
                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 border-t border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                  {(t.customer_name || t.note) && (
                      <div className="mb-4 text-xs space-y-1 bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 shadow-sm">
                          {t.customer_name && <div><span className="text-gray-500">Pelanggan:</span> <span className="font-bold dark:text-white">{t.customer_name}</span> {t.customer_phone && <span className="text-blue-500">({t.customer_phone})</span>}</div>}
                          {t.note && <div><span className="text-gray-500">Catatan:</span> <span className="font-medium text-yellow-600 dark:text-yellow-500">{t.note}</span></div>}
                      </div>
                  )}

                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Item Dibeli</h4>
                  <div className="space-y-2 mb-4 border-b dark:border-slate-700 pb-3">
                    {t.transaction_items.map((item: any, idx: number) => {
                      const isFree = item.price_at_purchase === 0;
                      return (
                        <div key={idx} className={`flex justify-between text-sm p-2 rounded ${isFree ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30' : ''}`}>
                          <div className="flex flex-col">
                            <span className="dark:text-gray-200 font-medium">{item.products?.name} <span className="text-gray-400 font-normal">x{item.quantity}</span></span>
                            {isFree && <span className="text-[10px] text-green-600 font-bold mt-0.5">BONUS / GRATIS</span>}
                          </div>
                          <span className={`font-medium ${isFree ? 'text-green-600' : 'dark:text-gray-200'}`}>{isFree ? 'Rp 0' : `Rp ${(item.price_at_purchase * item.quantity).toLocaleString()}`}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-1 mb-4 text-sm dark:text-gray-300">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>Rp {subtotal.toLocaleString()}</span></div>
                    {hasDiscount && <div className="flex justify-between text-red-500"><span>Diskon</span><span>- Rp {(subtotal - t.total_amount).toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold text-base pt-2 border-t dark:border-slate-700 mt-2"><span>Total Bayar</span><span>Rp {t.total_amount.toLocaleString()}</span></div>
                  </div>

                  {t.proof_images && t.proof_images.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Bukti Foto</h4>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {t.proof_images.map((img: string, i: number) => (
                          <div key={i} onClick={() => setPreviewImage(getImgUrl(img))} className="relative w-20 h-20 flex-shrink-0 cursor-pointer">
                             <img src={getImgUrl(img)} className="w-full h-full object-cover rounded-lg border dark:border-slate-600 shadow-sm"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
                       <button onClick={() => openReceipt(t)} className="flex items-center gap-2 text-blue-600 text-sm font-bold bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 px-3 py-2 rounded-lg hover:bg-blue-50 shadow-sm">
                         <Printer size={16}/> Struk
                       </button>

                       {isAdmin && (
                           <>
                           <button onClick={() => handleEdit(t)} className="flex items-center gap-2 text-orange-600 text-sm font-bold bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900 px-3 py-2 rounded-lg hover:bg-orange-50 shadow-sm">
                             <Edit size={16}/> Edit
                           </button>
                           <button onClick={() => deleteTransaction(t.id)} className="flex items-center gap-2 text-red-600 text-sm font-bold bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 px-3 py-2 rounded-lg hover:bg-red-50 shadow-sm">
                             <Trash2 size={16}/> Void
                           </button>
                           </>
                       )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* MODAL FULLSCREEN IMAGE */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-white/10 text-white p-2 rounded-full"><X size={24} /></button>
          <img src={previewImage} alt="Full" className="max-w-full max-h-[85vh] object-contain rounded-lg"/>
        </div>
      )}

      {/* MODAL EDIT TRANSAKSI */}
      {editModal && editData && (
        <div className="fixed inset-0 z-[99] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg dark:text-white">Edit Transaksi</h3>
                    <button onClick={() => setEditModal(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                </div>
                <div className="mb-4 text-[10px] text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200 text-justify leading-tight">
                    *Untuk menjaga sinkronisasi stok, <b>edit isi barang tidak diizinkan</b>. Jika barang salah, klik <b>Void</b> transaksi ini.
                </div>
                <form onSubmit={saveEdit} className="space-y-4">
                    {/* FIELD TANGGAL TRANSAKSI BARU */}
                    <div>
                        <label className="text-xs font-bold text-gray-500">Waktu & Tanggal Transaksi</label>
                        <input 
                            type="datetime-local" 
                            className="w-full border p-2 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-2 focus:ring-pop-green outline-none mt-1" 
                            value={editData.created_at} 
                            onChange={e => setEditData({...editData, created_at: e.target.value})} 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-bold text-gray-500">Metode Bayar</label>
                            <select className="w-full border p-2 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-2 focus:ring-pop-green outline-none" value={editData.payment_method} onChange={e => setEditData({...editData, payment_method: e.target.value})}>
                                <option value="cash">Cash</option><option value="transfer">Transfer</option><option value="split">Split</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Lokasi / Event</label>
                            <input type="text" className="w-full border p-2 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-2 focus:ring-pop-green outline-none" value={editData.location_event} onChange={e => setEditData({...editData, location_event: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Catatan / Note</label>
                        <input type="text" placeholder="Kosong..." className="w-full border p-2 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-2 focus:ring-pop-green outline-none" value={editData.note} onChange={e => setEditData({...editData, note: e.target.value})} />
                    </div>
                    <div className="border-t dark:border-slate-700 pt-2 mt-2">
                        <label className="text-xs font-bold text-gray-500">Nama Pelanggan</label>
                        <input type="text" placeholder="Kosong..." className="w-full border p-2 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 mb-3 focus:ring-2 focus:ring-pop-green outline-none" value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} />
                        
                        <label className="text-xs font-bold text-gray-500">No. HP Pelanggan</label>
                        <input type="text" placeholder="Kosong..." className="w-full border p-2 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-2 focus:ring-pop-green outline-none" value={editData.customer_phone} onChange={e => setEditData({...editData, customer_phone: e.target.value})} />
                    </div>
                    
                    <button type="submit" className="w-full bg-pop-green hover:bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm flex justify-center mt-4 transition-colors">
                        Simpan Perubahan
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL STRUK */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <h2 className="text-white font-bold text-xl mb-4 mt-20">Struk Salinan (Copy)</h2>
            <div className="bg-white p-5 max-w-[300px] w-full mx-auto shadow-2xl shrink-0" ref={receiptRef} style={{fontFamily: 'monospace', color: '#000000', backgroundColor: '#ffffff'}}>
                <div className="text-center mb-4">
                    <h1 className="font-bold text-xl tracking-widest">POPCIONARDES</h1>
                    <p className="text-[10px] uppercase">Bekasi, West Java, Indonesia</p>
                </div>
                <div className="border-t border-dashed border-gray-400 my-2"></div>
                <div className="text-[10px] space-y-1">
                    <div className="flex justify-between"><span>No:</span><span className="font-bold">{receiptData.notaId}</span></div>
                    <div className="flex justify-between"><span>Tgl:</span><span>{receiptData.date}</span></div>
                    <div className="flex justify-between"><span>Kasir:</span><span>{receiptData.cashier}</span></div>
                    <div className="flex justify-between"><span>Event:</span><span>{receiptData.event}</span></div>
                </div>
                <div className="border-t border-dashed border-gray-400 my-2"></div>
                <div className="text-[10px] space-y-1 mb-2">
                    <div className="flex justify-between"><span>Pelanggan:</span><span className="font-bold">{receiptData.customerName}</span></div>
                    <div className="flex justify-between"><span>HP:</span><span>{receiptData.customerPhone}</span></div>
                </div>
                <div className="border-t-2 border-black my-2"></div>
                
                <div className="text-[10px] font-bold mb-1">DETAIL BELANJA:</div>
                <div className="text-[10px] space-y-2">
                    {receiptData.items.map((item: any, idx: number) => (
                        <div key={idx}>
                            <div className="flex justify-between">
                                <span className="font-bold truncate pr-2 w-3/4">{item.quantity}x {item.name}</span>
                                <span>{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                            <div className="pl-4 text-gray-500">@ Rp {item.price.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
                
                <div className="border-t border-dashed border-gray-400 my-2"></div>
                <div className="text-[10px] space-y-1">
                    <div className="flex justify-between"><span>Subtotal:</span><span>{receiptData.subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-red-500"><span>Diskon:</span><span>-{receiptData.discountAmount.toLocaleString()}</span></div>
                </div>
                <div className="border-t-2 border-black my-2"></div>
                <div className="flex justify-between font-bold text-sm"><span>TOTAL BAYAR:</span><span>Rp {receiptData.total.toLocaleString()}</span></div>
                <div className="flex justify-between text-[10px] mt-1"><span>Pembayaran:</span><span className="uppercase font-bold">{receiptData.paymentMethod}</span></div>
                {receiptData.note && <div className="flex justify-between text-[10px] mt-1"><span>Catatan:</span><span className="font-bold text-right">{receiptData.note}</span></div>}
                <div className="border-t border-dashed border-gray-400 my-4"></div>
                <div className="text-center text-[10px]">
                    <div className="font-bold">*** COPY RECEIPT ***</div>
                    <div>Struk ini adalah bukti resmi</div>
                </div>
            </div>

            <div className="flex gap-2 mt-6 mb-10 w-full max-w-[300px] shrink-0">
                <button onClick={downloadPDF} className="flex-1 bg-white text-gray-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 text-sm">
                    <Download size={18}/> Download
                </button>
                <button onClick={shareReceiptLink} disabled={isSharing} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/30 text-sm disabled:bg-gray-500 transition-colors">
                    {isSharing ? 'Memproses...' : <><Share2 size={18}/> Bagikan Ulang</>}
                </button>
            </div>
            <button onClick={() => setShowReceipt(false)} className="mb-10 text-gray-400 underline text-sm hover:text-white shrink-0">
                Tutup Struk
            </button>
        </div>
      )}
    </div>
  )
}