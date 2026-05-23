'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, ScanLine, PackageOpen, PlusCircle } from 'lucide-react'
import Scanner from './Scanner'
import toast from 'react-hot-toast'

interface ProductInputProps {
  onAddProduct: (product: any) => void
  onScanStateChange: (state: boolean) => void
}

export default function ProductInput({ onAddProduct, onScanStateChange }: ProductInputProps) {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setProducts(data)
  }

  // ========================================================
  // LISTENER SCANNER FISIK (USB / BLUETOOTH)
  // ========================================================
  useEffect(() => {
    let barcodeBuffer = ''
    let timeoutId: NodeJS.Timeout | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Abaikan jika kasir sedang mengetik manual di kolom Search/Catatan
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // 2. Jika scanner menekan "Enter" (tanda scan selesai)
      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
           e.preventDefault()
           const scannedBarcode = barcodeBuffer
           
           // Cari produk di database
           const found = products.find(p => p.barcode === scannedBarcode)
           if (found) {
               onAddProduct(found)
               toast.success(`Berhasil: ${found.name}`, { icon: '🛒' })
           } else {
               toast.error(`Barcode ${scannedBarcode} tidak terdaftar!`)
           }
        }
        barcodeBuffer = ''
        if (timeoutId) clearTimeout(timeoutId)
        return
      }

      // 3. Menangkap Karakter Angka/Huruf dari Scanner Fisik
      // Scanner mengetik sangat cepat (< 50ms per karakter)
      if (e.key.length === 1) {
        barcodeBuffer += e.key
        
        // Reset buffer jika jeda terlalu lama (artinya itu ketikan manusia, bukan mesin)
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => { barcodeBuffer = '' }, 100) 
      }
    }

    // Pasang alat pendengar ke layar
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [products, onAddProduct])

  // ========================================================

  const handleCameraScan = (barcodeText: string) => {
      setShowScanner(false)
      onScanStateChange(false)
      
      const found = products.find(p => p.barcode === barcodeText)
      if (found) {
          onAddProduct(found)
          toast.success(`Berhasil scan: ${found.name}`, { icon: '📷' })
      } else {
          toast.error(`Barcode ${barcodeText} tidak ditemukan.`)
      }
  }

  // Filter produk untuk pencarian manual
  const filteredProducts = useMemo(() => {
    if (!search) return []
    const s = search.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s)))
  }, [products, search])

  // Fungsi Tambah Manual Tanpa Database
  const handleAddManual = (e: React.FormEvent) => {
      e.preventDefault()
      const parts = search.split('*')
      if (parts.length === 2 && parts[0] && parts[1]) {
          const name = parts[0].trim()
          const price = parseInt(parts[1].replace(/[^0-9]/g, ''))
          if (name && price > 0) {
              onAddProduct({ id: Date.now(), name, price, stock: 9999, isManual: true })
              setSearch('')
              toast.success(`${name} ditambahkan manual!`)
          }
      } else {
          toast.error("Format salah! Ketik: NAMA * HARGA (Cth: Nasi Goreng * 15000)")
      }
  }

  return (
    <div className="p-4 select-none relative z-40 bg-gray-50 dark:bg-slate-900 transition-colors">
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari item / Barcode manual..." 
            className="w-full pl-10 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-pop-green transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        {/* Tombol Scanner Kamera HP */}
        <button 
            onClick={() => { setShowScanner(true); onScanStateChange(true) }} 
            className="bg-gray-800 hover:bg-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white p-3 rounded-xl shadow-sm flex items-center justify-center transition-transform active:scale-95"
        >
            <ScanLine size={24} />
        </button>
      </div>

      {/* HASIL PENCARIAN MANUAL */}
      {search && (
        <div className="absolute top-16 left-4 right-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border dark:border-slate-700 z-50 overflow-hidden max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2">
            
            {filteredProducts.length > 0 ? (
                filteredProducts.map(p => (
                    <div 
                        key={p.id} 
                        onClick={() => { onAddProduct(p); setSearch('') }}
                        className="p-3 border-b dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                        <div>
                            <div className="font-bold text-gray-800 dark:text-white">{p.name}</div>
                            <div className="text-[10px] text-gray-500">Stok: <span className={p.stock <= 5 ? 'text-red-500' : ''}>{p.stock}</span></div>
                        </div>
                        <div className="font-bold text-pop-green">Rp {p.price.toLocaleString()}</div>
                    </div>
                ))
            ) : (
                <div className="p-4 text-center">
                    <PackageOpen size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">"{search}" tidak ditemukan.</p>
                    
                    <form onSubmit={handleAddManual} className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border border-dashed border-gray-200 dark:border-slate-700">
                        <p className="text-[10px] text-gray-500 mb-2 font-bold uppercase">Tambah Item Non-Stok (Bebas)</p>
                        <button type="submit" className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-800">
                            <PlusCircle size={16}/> Masukkan ke Nota
                        </button>
                        <p className="text-[9px] text-center mt-2 text-gray-400">Pastikan formatnya: <b>NAMA * HARGA</b></p>
                    </form>
                </div>
            )}
        </div>
      )}

      {/* SCANNER KAMERA FULLSCREEN */}
      {showScanner && (
          <Scanner 
            onScan={handleCameraScan} 
            onClose={() => { setShowScanner(false); onScanStateChange(false) }} 
          />
      )}
    </div>
  )
}