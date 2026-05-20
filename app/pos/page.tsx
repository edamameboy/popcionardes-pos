'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import ProductInput from '@/components/ProductInput'
import { Camera, Trash2, X, Plus, Minus, Gift, ChevronUp, ChevronDown, CheckCircle, Download, Share2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'
import { toPng } from 'html-to-image' 
import jsPDF from 'jspdf'

export default function POS() {
  const network = useNetwork()
  const [cart, setCart] = useState<any[]>([])
  
  // State Form Transaksi
  const [location, setLocation] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [note, setNote] = useState('') // STATE BARU UNTUK CATATAN (SPLIT)
  const [discountType, setDiscountType] = useState('percent') 
  const [discountValue, setDiscountValue] = useState(0)
  const [proofFiles, setProofFiles] = useState<File[]>([]) 
  const [loading, setLoading] = useState(false)
  
  // State Pelanggan
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  // State Struk
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [isSharing, setIsSharing] = useState(false) 
  const receiptRef = useRef<HTMLDivElement>(null)

  const [eventHistory, setEventHistory] = useState<string[]>([])
  const [isScanning, setIsScanning] = useState(false) 
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchEventHistory = async () => {
      const { data } = await supabase.from('transactions').select('location_event').not('location_event', 'is', null).order('created_at', { ascending: false }).limit(100)
      if (data) {
        const uniqueEvents = Array.from(new Set(data.map(item => item.location_event))).filter(evt => evt && evt.trim() !== '')
        setEventHistory(uniqueEvents)
      }
    }
    fetchEventHistory()
  }, [])

  const handleScroll = () => { if (isPanelExpanded) setIsPanelExpanded(false) }

  // --- LOGIKA CART ---
  const getTotalQtyInCart = (id: any) => cart.filter(i => i.id === id).reduce((sum, i) => sum + i.quantity, 0)

  const addToCart = (product: any) => {
    const isManual = product.isManual === true
    if (!isManual) {
        const usedStock = getTotalQtyInCart(product.id)
        if (usedStock + 1 > product.stock) return alert(`Stok habis! Sisa: ${product.stock}`)
    }
    setCart(prev => {
      const idx = prev.findIndex(p => p.id === product.id && p.price === product.price)
      if (idx >= 0) { const newCart = [...prev]; newCart[idx].quantity += 1; return newCart }
      return [...prev, { ...product, quantity: 1, original_price: product.price, cartId: Date.now() + Math.random() }]
    })
  }

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(p => p.cartId === cartId)
      if (!item) return prev
      if (delta > 0 && !item.isManual) {
         if (getTotalQtyInCart(item.id) + 1 > item.stock) { alert('Stok Habis!'); return prev }
      }
      return prev.map(p => {
        if (p.cartId === cartId) { const newQty = p.quantity + delta; if (newQty < 1) return p; return { ...p, quantity: newQty } }
        return p
      })
    })
  }

  const toggleFreeItem = (cartId: string) => {
    setCart(prev => {
      const idx = prev.findIndex(p => p.cartId === cartId); if (idx === -1) return prev; const item = prev[idx]
      if (item.price !== 0) {
        if (item.quantity > 1) { const splitPaid = { ...item, quantity: item.quantity - 1 }; const splitFree = { ...item, quantity: 1, price: 0, cartId: Date.now() + Math.random() }; const newCart = [...prev]; newCart.splice(idx, 1, splitPaid, splitFree); return newCart }
        const newCart = [...prev]; newCart[idx] = { ...item, price: 0 }; return newCart
      } else { const newCart = [...prev]; newCart[idx] = { ...item, price: item.original_price }; return newCart }
    })
  }

  const removeFromCart = (cartId: string) => { if(confirm('Hapus item?')) setCart(prev => prev.filter(i => i.cartId !== cartId)) }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const discountAmount = discountType === 'percent' ? (subtotal * discountValue) / 100 : discountValue
  const total = Math.max(0, subtotal - discountAmount)

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { if (proofFiles.length >= 5) return alert("Maks 5 foto"); setProofFiles(prev => [...prev, e.target.files![0]]) }
  }
  const removeFile = (i: number) => setProofFiles(prev => prev.filter((_, idx) => idx !== i))

  const handlePreCheckout = () => {
    if (cart.length === 0) return
    if (paymentMethod === 'split' && !note.trim()) {
        return alert("Jika memilih pembayaran Split, wajib mengisi detail di kolom Catatan (Contoh: Cash 50rb, TF 50rb).")
    }
    setShowCustomerModal(true)
  }

  const handleFinalCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const userId = (await supabase.auth.getUser()).data.user?.id || 'offline-user'
    
    const currentNotaId = `TR-${Date.now().toString().slice(-8)}`
    const receiptInfo = {
      notaId: currentNotaId,
      date: new Date().toLocaleString('id-ID'),
      cashier: 'Admin Kasir',
      event: location || 'Umum/Toko',
      customerName: customerName || 'Pelanggan Umum',
      customerPhone: customerPhone || '-',
      customerEmail: customerEmail || '-',
      items: [...cart],
      subtotal, discountAmount, discountType, discountValue, total, paymentMethod,
      note // Masukkan nota ke struk
    }

    try {
      if (!network.online) throw new Error('OFFLINE_MODE')

      const processedCart = []
      for (const item of cart) {
        if (item.isManual) {
            const { data: newProd, error: prodError } = await supabase.from('products').insert({
                name: `(Manual) ${item.name}`, price: item.price, stock: 9999, sku: `MANUAL-${Date.now()}`,
            }).select().single()
            if (prodError || !newProd) throw new Error("Gagal menyimpan produk manual: " + (prodError?.message || "Error"))
            processedCart.push({ ...item, id: newProd.id })
        } else { processedCart.push(item) }
      }

      const urls: string[] = []
      for (const file of proofFiles) {
          const ext = file.name.split('.').pop(); const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
          const { data } = await supabase.storage.from('pos-images').upload(name, file); if (data) urls.push(data.path)
      }

      // TAMBAHAN: Simpan catatan split ke database transaksi
      const { data: trans, error } = await supabase.from('transactions').insert({
          total_amount: total, payment_method: paymentMethod, 
          location_event: location,
          proof_images: urls, discount_type: discountType, discount_value: discountValue,
          note: note, // Simpan ke Supabase
          user_id: userId, created_at: new Date().toISOString()
      }).select().single()

      if (error) throw error

      const items = processedCart.map(i => ({ transaction_id: trans.id, product_id: i.id, quantity: i.quantity, price_at_purchase: i.price }))
      await supabase.from('transaction_items').insert(items)

      for (const i of processedCart) { if (!i.isManual) await supabase.rpc('decrement_stock', { row_id: i.id, quantity_to_sub: i.quantity }) }
      if (location && !eventHistory.includes(location)) { setEventHistory(prev => [location, ...prev]) }

    } catch (err: any) {
      console.log("Error...", err)
      const isNet = err.message === 'OFFLINE_MODE' || err.message.includes('fetch') || err.message.includes('network')
      if (isNet) {
           // IndexedDB belum ada kolom note, tapi ini aman untuk sementara (bisa di-update nanti)
           try { await db.transactions.add({ cart, total, paymentMethod, location, proofFiles, discountType, discountValue, userId, createdAt: Date.now() }) } 
           catch (e) { alert('Gagal simpan offline.'); setLoading(false); return }
      } else { alert('Error: ' + err.message); setLoading(false); return }
    }
    
    setShowCustomerModal(false)
    setReceiptData(receiptInfo)
    setShowReceipt(true)
    
    setCart([]); setProofFiles([]); setDiscountValue(0); 
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setNote('');
    setLoading(false); setIsPanelExpanded(true)
  }

  const generatePDFBlob = async () => {
    if (!receiptRef.current) return null
    try {
        await toPng(receiptRef.current, { cacheBust: true, backgroundColor: '#ffffff' })
        await new Promise(res => setTimeout(res, 100))

        const imgData = await toPng(receiptRef.current, { 
            quality: 0.7, pixelRatio: 1.5, cacheBust: true, backgroundColor: '#ffffff',
            style: { margin: '0', transform: 'scale(1)' } 
        })
        
        const pdfWidth = 80 
        const canvasWidth = receiptRef.current.offsetWidth
        const canvasHeight = receiptRef.current.offsetHeight
        const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth
        
        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]) 
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
        
        return pdf
    } catch (error) {
        console.error("Gagal Render PDF:", error)
        alert("Gagal merender struk PDF.")
        return null
    }
  }

  const downloadPDF = async () => {
    const pdf = await generatePDFBlob()
    if (pdf) pdf.save(`Struk_${receiptData.notaId}.pdf`)
  }

  const shareReceiptLink = async () => {
    if (!network.online) return alert("Anda sedang Offline. Silakan gunakan tombol Download PDF sementara waktu.")
    
    setIsSharing(true)
    try {
        const pdf = await generatePDFBlob()
        if (!pdf) throw new Error("Gagal render")

        const pdfBlob = pdf.output('blob')
        const file = new File([pdfBlob], `Struk_${receiptData.notaId}.pdf`, { type: 'application/pdf' })

        const filePath = `receipts/${receiptData.notaId}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage
            .from('pos-images')
            .upload(filePath, file, { contentType: 'application/pdf' })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('pos-images').getPublicUrl(filePath)
        
        // --- PERBAIKAN BUG SHARE DI SINI: Optional Chaining yang aman ---
        const receiptUrl = data?.publicUrl
        if (!receiptUrl) throw new Error("Gagal menghasilkan link struk")

        const textToShare = `Halo Kak *${receiptData.customerName}*,\nTerima kasih telah berbelanja di *POPCIONARDES*.\n\nTotal Belanja: *Rp ${receiptData.total.toLocaleString()}*\nNo Nota: ${receiptData.notaId}\n\nBerikut adalah link struk digital Anda:\n${receiptUrl}`

        setIsSharing(false) 

        if (navigator.share) {
            await navigator.share({
                title: `Struk Pembayaran - ${receiptData.notaId}`,
                text: textToShare,
            })
        } else {
            await navigator.clipboard.writeText(textToShare)
            alert("Berhasil! Link struk telah disalin ke clipboard.")
        }

    } catch (error: any) {
        setIsSharing(false)
        if (error.name !== 'AbortError') {
            console.error("Error Share Link:", error)
            alert("Gagal membagikan link struk: " + (error.message || "Pastikan koneksi stabil"))
        }
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors flex flex-col select-none">
      <div className="bg-white dark:bg-slate-800 p-4 border-b dark:border-slate-700 shadow-sm sticky top-0 z-30">
        <h1 className="font-bold text-lg dark:text-white">Kasir</h1>
      </div>
      
      <ProductInput onAddProduct={addToCart} onScanStateChange={setIsScanning} />
      
      <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-80" onTouchMove={handleScroll} onWheel={handleScroll}>
        {cart.length === 0 && <div className="text-center text-gray-400 py-10 italic">Keranjang Kosong</div>}
        {cart.map((item) => {
           const isFree = item.price === 0; const isManual = item.isManual === true;
           return (
            <div key={item.cartId} className={`bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border ${isFree ? 'border-green-400 dark:border-green-500' : isManual ? 'border-blue-300 dark:border-blue-700' : 'dark:border-slate-700'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold dark:text-white flex items-center gap-2">{item.name}
                    {isFree && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded font-bold">BONUS</span>}
                    {isManual && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold">MANUAL</span>}
                  </div>
                  <div className={`text-sm ${isFree ? 'text-green-600 font-bold' : 'text-gray-500'}`}>{isFree ? 'FREE (Rp 0)' : `Rp ${item.original_price?.toLocaleString()}`}</div>
                </div>
                <div className="font-bold dark:text-white text-lg">Rp {(item.price * item.quantity).toLocaleString()}</div>
              </div>
              <div className="flex justify-between items-center border-t dark:border-slate-700 pt-2 mt-2">
                <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <button onClick={() => updateQuantity(item.cartId, -1)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 rounded-l-lg select-none"><Minus size={16} /></button>
                  <span className="px-3 font-bold text-sm dark:text-white min-w-[30px] text-center select-none">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.cartId, 1)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 rounded-r-lg select-none"><Plus size={16} /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFreeItem(item.cartId)} className={`p-2 rounded-lg border select-none ${isFree ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white dark:bg-slate-800 text-gray-400 border-gray-200'}`}><Gift size={18} /></button>
                  <button onClick={() => removeFromCart(item.cartId)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 select-none"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
           )
        })}
      </div>

      <div className={`fixed bottom-16 left-0 w-full bg-white dark:bg-slate-800 border-t dark:border-slate-700 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] rounded-t-2xl z-30 transition-transform duration-300 ease-in-out flex flex-col ${isScanning ? 'translate-y-[120%]' : 'translate-y-0'}`}>
        <div onClick={() => setIsPanelExpanded(!isPanelExpanded)} className="w-full flex justify-center py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100 rounded-t-2xl"><div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full"></div></div>
        <div className="px-4 pb-4">
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isPanelExpanded ? 'max-h-[500px] opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}`}>
                
                {/* --- BARIS 1: LOKASI & PEMBAYARAN --- */}
                <div className="grid grid-cols-2 gap-3 mb-3 pt-1">
                    <div>
                        <input list="event-options" placeholder="Pilih / Ketik Event..." className="w-full border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={location} onChange={e => setLocation(e.target.value)} />
                        <datalist id="event-options">{eventHistory.map((evt, idx) => (<option key={idx} value={evt} />))}</datalist>
                    </div>
                    {/* OPSI SPLIT DITAMBAHKAN */}
                    <select className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="transfer">Transfer</option>
                        <option value="split">Split (Cash & TF)</option> 
                    </select>
                </div>

                {/* --- BARIS BARU: CATATAN (Muncul jika Split atau opsional) --- */}
                {paymentMethod === 'split' && (
                    <div className="mb-3 animate-in fade-in slide-in-from-top-2">
                        <input 
                            type="text" 
                            placeholder="Catatan Split (Misal: Cash 50rb, BCA 100rb)" 
                            className="w-full border p-2 rounded text-sm bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 dark:text-white placeholder-yellow-600 dark:placeholder-yellow-500" 
                            value={note} 
                            onChange={e => setNote(e.target.value)} 
                            required={paymentMethod === 'split'}
                        />
                    </div>
                )}

                <div className="flex gap-2 mb-3">
                    <select className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white w-20" value={discountType} onChange={e => setDiscountType(e.target.value)}><option value="percent">%</option><option value="nominal">Rp</option></select>
                    <input type="number" placeholder="Nilai Diskon" className="flex-1 border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={discountValue || ''} onChange={e => setDiscountValue(Number(e.target.value))} />
                </div>
                
                <div className="mb-1">
                    <div className="flex gap-2 overflow-x-auto pb-2 items-center no-scrollbar">
                    <label className={`flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-700 border-2 border-dashed border-gray-300 dark:border-slate-500 rounded-lg ${proofFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}><Camera size={18} className="text-gray-500 dark:text-gray-300" /><span className="text-[9px] text-gray-500 dark:text-gray-300 mt-1">{proofFiles.length}/5</span><input type="file" accept="image/*" capture="environment" disabled={proofFiles.length >= 5} className="hidden" onChange={handleCameraCapture} /></label>
                    {proofFiles.map((file, idx) => { let imgUrl = ''; try { imgUrl = URL.createObjectURL(file) } catch (err) { return null } return ( <div key={idx} className="relative w-16 h-16 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden border dark:border-slate-600"><img src={imgUrl} className="w-full h-full object-cover" alt="preview" onLoad={() => URL.revokeObjectURL(imgUrl)}/><button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl shadow-sm"><X size={10} /></button></div> ) })}
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t dark:border-slate-700 bg-white dark:bg-slate-800">
                {isPanelExpanded && discountValue > 0 && (<div className="flex justify-between text-sm text-red-500 animate-in fade-in"><span>Diskon Tambahan</span><span>- Rp {discountAmount.toLocaleString()}</span></div>)}
                <div className="flex justify-between items-center">
                    <div onClick={() => setIsPanelExpanded(!isPanelExpanded)} className="flex flex-col cursor-pointer select-none"><span className="text-xs text-gray-500 flex items-center gap-1">Total {isPanelExpanded ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}</span><span className="font-bold text-xl dark:text-white">Rp {total.toLocaleString()}</span></div>
                    
                    <button onClick={handlePreCheckout} disabled={loading || cart.length === 0} className="bg-pop-green hover:bg-pop-green-dark text-white px-8 py-3 rounded-xl font-bold text-lg disabled:bg-gray-300 dark:disabled:bg-slate-600 transition-colors shadow-lg shadow-pop-green/20 select-none">Bayar</button>
                </div>
            </div>
        </div>
      </div>

      {/* --- MODAL INPUT DATA PELANGGAN --- */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[99] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg dark:text-white">Data Pembeli (Opsional)</h3>
                    <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                </div>
                <form onSubmit={handleFinalCheckout} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500">Nama Pelanggan</label>
                        <input type="text" placeholder="Budi Santoso" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-2 focus:ring-pop-green" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Nomor WhatsApp</label>
                        <input type="tel" placeholder="0812345..." className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-2 focus:ring-pop-green" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Email</label>
                        <input type="email" placeholder="budi@email.com" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-2 focus:ring-pop-green" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-pop-green hover:bg-pop-green-dark text-white py-3 rounded-xl font-bold text-lg disabled:bg-gray-400 flex justify-center gap-2 mt-4 transition-colors select-none">
                        {loading ? 'Menyimpan...' : <><CheckCircle size={24} /> Selesaikan Pesanan</>}
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL HASIL STRUK --- */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <h2 className="text-white font-bold text-xl mb-4 mt-20">Transaksi Berhasil! 🎉</h2>
            
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
                
                {/* --- MUNCULKAN CATATAN DI STRUK JIKA ADA --- */}
                {receiptData.note && (
                     <div className="flex justify-between text-[10px] mt-1"><span>Catatan:</span><span className="font-bold text-right">{receiptData.note}</span></div>
                )}

                <div className="border-t border-dashed border-gray-400 my-4"></div>
                <div className="text-center text-[10px]">
                    <div className="font-bold">TERIMA KASIH</div>
                    <div>Struk ini adalah bukti resmi</div>
                </div>
            </div>

            <div className="flex gap-2 mt-6 mb-10 w-full max-w-[300px] shrink-0">
                <button onClick={downloadPDF} className="flex-1 bg-white text-gray-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 text-sm select-none">
                    <Download size={18}/> Download
                </button>
                <button onClick={shareReceiptLink} disabled={isSharing} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/30 text-sm disabled:bg-gray-500 transition-colors select-none">
                    {isSharing ? 'Memproses...' : <><Share2 size={18}/> Bagikan Struk</>}
                </button>
            </div>
            
            <button onClick={() => setShowReceipt(false)} className="mb-10 text-gray-400 underline text-sm hover:text-white shrink-0 select-none">
                Tutup & Transaksi Baru
            </button>
        </div>
      )}
    </div>
  )
}