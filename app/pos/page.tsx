'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import ProductInput from '@/components/ProductInput'
import { Camera, Trash2, X, Plus, Minus, Gift } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNetwork } from '@/hooks/useNetwork' // Hook Sinyal
import { db } from '@/utils/db' // Database Lokal

export default function POS() {
  const network = useNetwork()
  const [cart, setCart] = useState<any[]>([])
  
  // State Form
  const [location, setLocation] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountType, setDiscountType] = useState('percent') 
  const [discountValue, setDiscountValue] = useState(0)

  // State Foto & Loading
  const [proofFiles, setProofFiles] = useState<File[]>([]) 
  const [loading, setLoading] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) router.push('/login')
    }
    checkUser()
  }, [])

  // --- LOGIKA KERANJANG (CART) ---

  const getTotalQtyInCart = (productId: number) => {
    return cart.filter(item => item.id === productId).reduce((sum, item) => sum + item.quantity, 0)
  }

  const addToCart = (product: any) => {
    const usedStock = getTotalQtyInCart(product.id)
    if (usedStock + 1 > product.stock) {
      alert(`Stok habis! Total stok produk ini hanya: ${product.stock}`)
      return
    }

    setCart(prev => {
      const existingPaidItemIndex = prev.findIndex(p => p.id === product.id && p.price !== 0)

      if (existingPaidItemIndex >= 0) {
        const newCart = [...prev]
        newCart[existingPaidItemIndex].quantity += 1
        return newCart
      }

      return [...prev, { 
        ...product, 
        quantity: 1, 
        original_price: product.price,
        cartId: Date.now() + Math.random()
      }]
    })
  }

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(p => p.cartId === cartId)
      if (!item) return prev

      if (delta > 0) {
        const usedStock = getTotalQtyInCart(item.id)
        if (usedStock + 1 > item.stock) {
          alert(`Stok tidak cukup! Sisa: ${item.stock}`)
          return prev
        }
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
      const targetIndex = prev.findIndex(p => p.cartId === cartId)
      if (targetIndex === -1) return prev

      const item = prev[targetIndex]
      const isCurrentlyFree = item.price === 0

      if (!isCurrentlyFree) {
        if (item.quantity > 1) {
          const newItemPaid = { ...item, quantity: item.quantity - 1 }
          const newItemFree = { 
            ...item, 
            quantity: 1, 
            price: 0, 
            cartId: Date.now() + Math.random() 
          }
          const newCart = [...prev]
          newCart.splice(targetIndex, 1, newItemPaid, newItemFree)
          return newCart
        } 
        const newCart = [...prev]
        newCart[targetIndex] = { ...item, price: 0 }
        return newCart
      } else {
        const newCart = [...prev]
        newCart[targetIndex] = { ...item, price: item.original_price }
        return newCart
      }
    })
  }

  const removeFromCart = (cartId: string) => {
    if(confirm('Hapus item ini?')) {
      setCart(prev => prev.filter(item => item.cartId !== cartId))
    }
  }

  // --- PERHITUNGAN TOTAL ---
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const discountAmount = discountType === 'percent' 
    ? (subtotal * discountValue) / 100 
    : discountValue
  const total = Math.max(0, subtotal - discountAmount)

  // --- LOGIKA KAMERA & UPLOAD AMAN ---
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    
    // Perbaikan: Ambil file ke variabel dulu sebelum dimasukkan ke state
    if (fileList && fileList[0]) {
      const file = fileList[0]

      if (proofFiles.length >= 5) {
        alert("Maksimal 5 foto!")
        return
      }

      setProofFiles(prev => [...prev, file])
      e.target.value = '' 
    }
  }

  const removeFile = (index: number) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index))
  }

  // --- CHECKOUT HYBRID (ONLINE -> FALLBACK OFFLINE) ---
  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)

    // Siapkan data transaksi object untuk disimpan
    const transactionData = {
      cart,
      total,
      paymentMethod,
      location,
      proofFiles,
      discountType,
      discountValue,
      userId: (await supabase.auth.getUser()).data.user?.id || 'offline-user',
      createdAt: Date.now()
    }
    
    try {
      // 1. CEK SINYAL (Filter Pertama)
      if (!network.online) {
        throw new Error('OFFLINE_MODE') // Lempar ke catch agar disimpan offline
      }

      // 2. PROSES ONLINE (Upload Foto & Insert DB)
      const uploadedUrls: string[] = []
      if (proofFiles.length > 0) {
        for (const file of proofFiles) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const { data, error } = await supabase.storage.from('pos-images').upload(fileName, file)
          
          if (error) throw error // Lempar error jika upload gagal (koneksi putus)
          if (data) uploadedUrls.push(data.path)
        }
      }

      // Insert Transaksi ke Supabase
      const { data: trans, error: transError } = await supabase
        .from('transactions')
        .insert({
          total_amount: total,
          payment_method: paymentMethod,
          location_event: location,
          proof_images: uploadedUrls,
          discount_type: discountType,
          discount_value: discountValue,
          user_id: transactionData.userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (transError) throw transError

      // Insert Items
      const itemsData = cart.map(item => ({
        transaction_id: trans.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_purchase: item.price
      }))
      
      await supabase.from('transaction_items').insert(itemsData)

      // Update Stock Server
      for (const item of cart) {
        await supabase.rpc('decrement_stock', { row_id: item.id, quantity_to_sub: item.quantity })
      }

      alert('Transaksi Berhasil (Online)!')

    } catch (error: any) {
      // 3. PENANGANAN ERROR & FALLBACK KE OFFLINE
      console.log("Gagal Online, mencoba simpan Offline...", error.message)

      const isNetworkError = 
        error.message === 'OFFLINE_MODE' || 
        error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('connection');

      if (isNetworkError) {
        try {
          // SIMPAN KE DEXIE (OFFLINE DATABASE)
          await db.transactions.add(transactionData)
          alert('Sinyal lemah/Offline. Data disimpan di HP & akan otomatis di-upload nanti.')
        } catch (dbError) {
          alert('FATAL: Gagal simpan ke database HP. Coba refresh aplikasi.')
          console.error(dbError)
          setLoading(false)
          return // Jangan reset form kalau gagal total
        }
      } else {
        // Jika error validasi server, tampilkan error asli
        alert('Error: ' + error.message)
        setLoading(false)
        return
      }
    }

    // Reset Form (Hanya jika sukses online atau sukses simpan offline)
    setCart([])
    setProofFiles([])
    setLocation('')
    setDiscountValue(0)
    setLoading(false)
  }

  return (
    <div className="pb-52 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="bg-white dark:bg-slate-800 p-4 border-b dark:border-slate-700 shadow-sm sticky top-0 z-30">
        <h1 className="font-bold text-lg dark:text-white">Kasir</h1>
      </div>

      <ProductInput onAddProduct={addToCart} />

      <div className="p-4 space-y-3">
        {cart.length === 0 && (
          <div className="text-center text-gray-400 py-10 italic">Keranjang Kosong</div>
        )}

        {cart.map((item) => {
           const isFree = item.price === 0;
           return (
            <div key={item.cartId} className={`bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border ${isFree ? 'border-green-400 dark:border-green-500' : 'dark:border-slate-700'}`}>
              
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold dark:text-white flex items-center gap-2">
                    {item.name}
                    {isFree && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded font-bold">BONUS</span>}
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
                  <button 
                    onClick={() => toggleFreeItem(item.cartId)}
                    className={`p-2 rounded-lg border ${isFree ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white dark:bg-slate-800 text-gray-400 border-gray-200'}`}
                  >
                    <Gift size={18} />
                  </button>

                  <button onClick={() => removeFromCart(item.cartId)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
           )
        })}
      </div>

      <div className="fixed bottom-16 w-full bg-white dark:bg-slate-800 border-t dark:border-slate-700 p-4 shadow-[0_-5px_15px_rgba(0,0,0,0.1)] rounded-t-2xl z-30 transition-colors">
        
        {/* Input Lokasi & Payment */}
        <div className="grid grid-cols-2 gap-3 mb-3">
           <input 
             placeholder="Lokasi Event" 
             className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
             value={location}
             onChange={e => setLocation(e.target.value)} 
           />
           <select 
             className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
             value={paymentMethod}
             onChange={e => setPaymentMethod(e.target.value)}
           >
             <option value="cash">Cash</option>
             <option value="transfer">Transfer</option>
           </select>
        </div>

        {/* Input Diskon */}
        <div className="flex gap-2 mb-3">
            <select 
              className="border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white w-20"
              value={discountType}
              onChange={e => setDiscountType(e.target.value)}
            >
              <option value="percent">%</option>
              <option value="nominal">Rp</option>
            </select>
            <input 
              type="number" 
              placeholder="Nilai Diskon" 
              className="flex-1 border p-2 rounded text-sm bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
              value={discountValue || ''}
              onChange={e => setDiscountValue(Number(e.target.value))} 
            />
        </div>

        {/* Preview Foto Bukti (AMAN DARI ERROR) */}
        <div className="mb-3">
            <div className="flex gap-2 overflow-x-auto pb-2 items-center no-scrollbar">
              <label className={`flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-700 border-2 border-dashed border-gray-300 dark:border-slate-500 rounded-lg ${proofFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <Camera size={18} className="text-gray-500 dark:text-gray-300" />
                  <span className="text-[9px] text-gray-500 dark:text-gray-300 mt-1">
                    {proofFiles.length}/5
                  </span>
                  <input type="file" accept="image/*" capture="environment" disabled={proofFiles.length >= 5} className="hidden" onChange={handleCameraCapture} />
              </label>
              
              {proofFiles.map((file, idx) => {
                // PENGECEKAN KEAMANAN: Jangan render jika file invalid
                if (!file || typeof file !== 'object') return null

                // Buat URL dengan aman (Try-Catch)
                let imgUrl = ''
                try {
                  imgUrl = URL.createObjectURL(file)
                } catch (err) {
                  console.error("Gagal load gambar", err)
                  return null // Skip render gambar ini jika error
                }

                return (
                  <div key={idx} className="relative w-16 h-16 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden border dark:border-slate-600">
                    <img 
                      src={imgUrl} 
                      className="w-full h-full object-cover" 
                      alt="preview" 
                      // Hapus dari memori setelah load agar ringan
                      onLoad={() => URL.revokeObjectURL(imgUrl)}
                    />
                    <button 
                      onClick={() => removeFile(idx)} 
                      className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl shadow-sm"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
        </div>

        {/* Total & Tombol Bayar */}
        <div className="flex flex-col gap-1 mb-3 pt-2 border-t dark:border-slate-700">
           {discountValue > 0 && (
             <div className="flex justify-between text-sm text-red-500">
                <span>Diskon Tambahan</span>
                <span>- Rp {discountAmount.toLocaleString()}</span>
             </div>
           )}
           <div className="flex justify-between items-center font-bold text-xl dark:text-white">
              <span>Total</span>
              <span>Rp {total.toLocaleString()}</span>
           </div>
        </div>
        
        <button 
          onClick={handleCheckout} 
          disabled={loading || cart.length === 0}
          className="w-full bg-pop-green hover:bg-pop-green-dark text-white py-3 rounded-xl font-bold text-lg disabled:bg-gray-300 dark:disabled:bg-slate-600 transition-colors shadow-lg shadow-pop-green/20"
        >
          {loading ? 'Memproses...' : 'Bayar Sekarang'}
        </button>
      </div>
    </div>
  )
}