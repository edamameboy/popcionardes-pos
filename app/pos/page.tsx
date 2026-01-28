'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import ProductInput from '@/components/ProductInput'
import { Camera, Trash2, X, Plus, Minus, Gift, ChevronUp, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'

export default function POS() {
  const network = useNetwork()
  const [cart, setCart] = useState<any[]>([])
  
  // State Form
  const [location, setLocation] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountType, setDiscountType] = useState('percent') 
  const [discountValue, setDiscountValue] = useState(0)
  const [proofFiles, setProofFiles] = useState<File[]>([]) 
  const [loading, setLoading] = useState(false)
  
  // State Riwayat Event
  const [eventHistory, setEventHistory] = useState<string[]>([])
  
  // State UI
  const [isScanning, setIsScanning] = useState(false) 
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)

  const supabase = createClient()
  const router = useRouter()

  // 1. Fetch Riwayat Event saat Load
  useEffect(() => {
    const fetchEventHistory = async () => {
      // Ambil 100 transaksi terakhir agar tidak terlalu berat
      const { data } = await supabase
        .from('transactions')
        .select('location_event')
        .not('location_event', 'is', null) // Jangan ambil yang kosong
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) {
        // Filter duplikat menggunakan Set
        const uniqueEvents = Array.from(new Set(data.map(item => item.location_event)))
          .filter(evt => evt && evt.trim() !== '') // Pastikan tidak string kosong
        
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
      if (idx >= 0) {
        const newCart = [...prev]; newCart[idx].quantity += 1; return newCart
      }
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
        if (p.cartId === cartId) {
          const newQty = p.quantity + delta
          if (newQty < 1) return p 
          return { ...p, quantity: newQty }
        }
        return p
      })
    })
  }

  const toggleFreeItem = (cartId: string) => {
    setCart(prev => {
      const idx = prev.findIndex(p => p.cartId === cartId)
      if (idx === -1) return prev
      const item = prev[idx]
      if (item.price !== 0) {
        if (item.quantity > 1) {
            const splitPaid = { ...item, quantity: item.quantity - 1 }
            const splitFree = { ...item, quantity: 1, price: 0, cartId: Date.now() + Math.random() }
            const newCart = [...prev]; newCart.splice(idx, 1, splitPaid, splitFree); return newCart
        }
        const newCart = [...prev]; newCart[idx] = { ...item, price: 0 }; return newCart
      } else {
        const newCart = [...prev]; newCart[idx] = { ...item, price: item.original_price }; return newCart
      }
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


  // --- CHECKOUT ---
  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    const userId = (await supabase.auth.getUser()).data.user?.id || 'offline-user'
    
    try {
      if (!network.online) throw new Error('OFFLINE_MODE')

      // A. Handle Manual Products
      const processedCart = []
      for (const item of cart) {
        if (item.isManual) {
            const { data: newProd, error: prodError } = await supabase.from('products').insert({
                name: `(Manual) ${item.name}`,
                price: item.price,
                stock: 9999,
                category: 'Manual',
                description: 'Input Manual saat Kasir'
            }).select().single()

            if (prodError || !newProd) throw new Error("Gagal menyimpan produk manual: " + item.name)
            processedCart.push({ ...item, id: newProd.id })
        } else {
            processedCart.push(item)
        }
      }

      // B. Upload Images
      const urls: string[] = []
      for (const file of proofFiles) {
          const ext = file.name.split('.').pop(); const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
          const { data } = await supabase.storage.from('pos-images').upload(name, file)
          if (data) urls.push(data.path)
      }

      // C. Save Transaction
      const { data: trans, error } = await supabase.from('transactions').insert({
          total_amount: total, payment_method: paymentMethod, location_event: location,
          proof_images: urls, discount_type: discountType, discount_value: discountValue,
          user_id: userId, created_at: new Date().toISOString()
      }).select().single()

      if (error) throw error

      // D. Save Items
      const items = processedCart.map(i => ({ 
          transaction_id: trans.id, product_id: i.id, quantity: i.quantity, price_at_purchase: i.price 
      }))
      await supabase.from('transaction_items').insert(items)

      // E. Update Stock
      for (const i of processedCart) {
         if (!i.isManual) await supabase.rpc('decrement_stock', { row_id: i.id, quantity_to_sub: i.quantity })
      }

      // F. UPDATE RIWAYAT EVENT DI LOKAL (Agar muncul di dropdown berikutnya)
      if (location && !eventHistory.includes(location)) {
        setEventHistory(prev => [location, ...prev])
      }

      alert('Berhasil (Online)!')
    } catch (err: any) {
      console.log("Error...", err)
      const isNet = err.message === 'OFFLINE_MODE' || err.message.includes('fetch') || err.message.includes('network')
      
      if (isNet) {
          alert("Mode Offline: Transaksi tersimpan. (Produk manual mungkin butuh sinkronisasi nanti).")
           try { 
             await db.transactions.add({
                cart, total, paymentMethod, location, proofFiles, discountType, discountValue,
                userId, createdAt: Date.now()
             }); 
             alert('Data disimpan di HP.') 
           } catch (e) { alert('Gagal simpan offline.'); setLoading(false); return }
      } else {
          alert('Error: ' + err.message); setLoading(false); return
      }
    }
    
    // Reset State
    setCart([]); setProofFiles([]); 
    // setLocation(''); // Opsional: Biarkan lokasi tetap terisi jika ingin input cepat di event yang sama
    setDiscountValue(0); setLoading(false); setIsPanelExpanded(true)
  }

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors flex flex-col">
      <div className="bg-white dark:bg-slate-800 p-4 border-b dark:border-slate-700 shadow-sm sticky top-0 z-30">
        <h1 className="font-bold text-lg dark:text-white">Kasir</h1>
      </div>

      <ProductInput onAddProduct={addToCart} onScanStateChange={setIsScanning} />

      <div 
        className="flex-1 p-4 space-y-3 overflow-y-auto pb-80" 
        onTouchMove={handleScroll} onWheel={handleScroll}
      >
        {cart.length === 0 && <div className="text-center text-gray-400 py-10 italic">Keranjang Kosong</div>}

        {cart.map((item) => {
           const isFree = item.price === 0;
           const isManual = item.isManual === true;
           return (
            <div key={item.cartId} className={`bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border ${isFree ? 'border-green-400 dark:border-green-500' : isManual ? 'border-blue-300 dark:border-blue-700' : 'dark:border-slate-700'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold dark:text-white flex items-center gap-2">
                    {item.name}
                    {isFree && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded font-bold">BONUS</span>}
                    {isManual && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold">MANUAL</span>}
                  </div>
                  <div className={`text-sm ${isFree ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                    {isFree ? 'FREE (Rp 0)' : `Rp ${item.original_price?.toLocaleString()}`}
                  </div>
                </div>
                <div className="font-bold dark:text-white text-lg">
                   Rp {(item.price * item.quantity).toLocaleString()}
                </div>
              </div>
              <div className="flex justify-between items-center border-t dark:border-slate-700 pt-2 mt-2">
                <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <button onClick={() => updateQuantity(item.cartId, -1)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 rounded-l-lg"><Minus size={16} /></button>
                  <span className="px-3 font-bold text-sm dark:text-white min-w-[30px] text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.cartId, 1)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 rounded-r-lg"><Plus size={16} /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFreeItem(item.cartId)} className={`p-2 rounded-lg border ${isFree ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white dark:bg-slate-800 text-gray-400 border-gray-200'}`}><Gift size={18} /></button>
                  <button onClick={() => removeFromCart(item.cartId)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
           )
        })}
      </div>

      {/* --- PANEL PEMBAYARAN --- */}
      <div className={`fixed bottom-16 left-0 w-full bg-white dark:bg-slate-800 border-t dark:border-slate-700 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] rounded-t-2xl z-30 transition-transform duration-300 ease-in-out flex flex-col ${isScanning ? 'translate-y-[120%]' : 'translate-y-0'}`}>
        <div onClick={() => setIsPanelExpanded(!isPanelExpanded)} className="w-full flex justify-center py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100 rounded-t-2xl">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full"></div>
        </div>
        <div className="px-4 pb-4">
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isPanelExpanded ? 'max-h-96 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}`}>
                
                {/* INPUT HYBRID (DROPDOWN + TEXT) */}
                <div className="grid grid-cols-2 gap-3 mb-3 pt-1">
                    <div>
                        <input 
                            list="event-options" 
                            placeholder="Pilih / Ketik Event..." 
                            className="w-full border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                            value={location}
                            onChange={e => setLocation(e.target.value)} 
                        />
                        <datalist id="event-options">
                            {eventHistory.map((evt, idx) => (
                                <option key={idx} value={evt} />
                            ))}
                        </datalist>
                    </div>

                    <select className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="cash">Cash</option><option value="transfer">Transfer</option>
                    </select>
                </div>

                <div className="flex gap-2 mb-3">
                    <select className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white w-20" value={discountType} onChange={e => setDiscountType(e.target.value)}><option value="percent">%</option><option value="nominal">Rp</option></select>
                    <input type="number" placeholder="Nilai Diskon" className="flex-1 border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={discountValue || ''} onChange={e => setDiscountValue(Number(e.target.value))} />
                </div>
                <div className="mb-1">
                    <div className="flex gap-2 overflow-x-auto pb-2 items-center no-scrollbar">
                    <label className={`flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-700 border-2 border-dashed border-gray-300 dark:border-slate-500 rounded-lg ${proofFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}><Camera size={18} className="text-gray-500 dark:text-gray-300" /><span className="text-[9px] text-gray-500 dark:text-gray-300 mt-1">{proofFiles.length}/5</span><input type="file" accept="image/*" capture="environment" disabled={proofFiles.length >= 5} className="hidden" onChange={handleCameraCapture} /></label>
                    {proofFiles.map((file, idx) => {
                        let imgUrl = ''; try { imgUrl = URL.createObjectURL(file) } catch (err) { return null }
                        return ( <div key={idx} className="relative w-16 h-16 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden border dark:border-slate-600"><img src={imgUrl} className="w-full h-full object-cover" alt="preview" onLoad={() => URL.revokeObjectURL(imgUrl)}/><button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl shadow-sm"><X size={10} /></button></div> )
                    })}
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t dark:border-slate-700 bg-white dark:bg-slate-800">
                {isPanelExpanded && discountValue > 0 && (<div className="flex justify-between text-sm text-red-500 animate-in fade-in"><span>Diskon Tambahan</span><span>- Rp {discountAmount.toLocaleString()}</span></div>)}
                <div className="flex justify-between items-center">
                    <div onClick={() => setIsPanelExpanded(!isPanelExpanded)} className="flex flex-col cursor-pointer"><span className="text-xs text-gray-500 flex items-center gap-1">Total {isPanelExpanded ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}</span><span className="font-bold text-xl dark:text-white">Rp {total.toLocaleString()}</span></div>
                    <button onClick={handleCheckout} disabled={loading || cart.length === 0} className="bg-pop-green hover:bg-pop-green-dark text-white px-8 py-3 rounded-xl font-bold text-lg disabled:bg-gray-300 dark:disabled:bg-slate-600 transition-colors shadow-lg shadow-pop-green/20">{loading ? 'Proses...' : 'Bayar'}</button>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}