'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, X, Barcode, ScanLine, XCircle, PenTool, Check } from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function ProductInput({ 
  onAddProduct, 
  onScanStateChange 
}: { 
  onAddProduct: (p: any) => void;
  onScanStateChange?: (isOpen: boolean) => void;
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  
  // STATE BARU: Untuk Input Manual
  const [showManual, setShowManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')

  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const network = useNetwork()

  // --- 1. LOGIKA SCANNER (Sama seperti sebelumnya) ---
  useEffect(() => {
    if (onScanStateChange) onScanStateChange(showScanner || showManual) // Handle panel bawah tertutup saat manual input juga

    if (showScanner) {
      const timer = setTimeout(() => {
          const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false);
          scanner.render((decodedText) => { setQuery(decodedText); scanner.clear(); setShowScanner(false) }, (err) => {});
          return () => { scanner.clear().catch(err => console.error(err)) }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showScanner, showManual])

  // --- 2. LOGIKA PENCARIAN (Sama seperti sebelumnya) ---
  useEffect(() => {
    if (!query) { setResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    searchTimeout.current = setTimeout(async () => {
      setLoading(true)
      try {
        let onlineResults: any[] = []
        let errorOnline = null

        if (network.online) {
          try {
            const { data, error } = await supabase.from('products').select('*')
              .or(`name.ilike.%${query}%,description.ilike.%${query}%,barcode.ilike.%${query}%`).limit(10)
            if (error) throw error
            if (data) onlineResults = data
          } catch (err) { errorOnline = err }
        }

        if (!network.online || onlineResults.length === 0 || errorOnline) {
           const keyword = query.toLowerCase()
           const localData = await db.products.filter(p => 
               p.name.toLowerCase().includes(keyword) || 
               (p.barcode && p.barcode.includes(keyword)) ||
               (p.description && p.description.toLowerCase().includes(keyword)) || false
            ).limit(10).toArray()
           setResults(localData)
        } else { setResults(onlineResults) }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }, 500)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [query, network.online])

  useEffect(() => {
    if (query && results.length === 1 && !loading) {
       if (results[0].barcode === query) { onAddProduct(results[0]); setQuery(''); setResults([]) }
    }
  }, [results, loading, query])

  // --- 3. FUNGSI SUBMIT MANUAL ---
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualName || !manualPrice) return alert("Nama dan Harga wajib diisi!")

    // Kita buat object produk "Palsu" tapi struktur datanya sama
    const manualProduct = {
        id: `manual-${Date.now()}`, // ID sementara (string unik)
        name: manualName,
        price: parseInt(manualPrice.replace(/\D/g, '')), // Hapus karakter non-angka
        stock: 9999, // Stok dianggap banyak
        isManual: true, // Penanda khusus
        category: 'Manual'
    }

    onAddProduct(manualProduct)
    
    // Reset & Tutup
    setManualName('')
    setManualPrice('')
    setShowManual(false)
  }

  return (
    <div className="p-4 relative z-20">
      <div className="relative flex gap-2">
        {/* INPUT PENCARIAN */}
        <div className="relative flex-1">
            <div className="absolute left-3 top-3 text-gray-400">
              {loading ? <span className="animate-spin">⏳</span> : <Search size={20} />}
            </div>
            <input 
              type="text" placeholder="Ketik / Scan Barcode..."
              className={`w-full pl-10 pr-10 p-3 rounded-xl border outline-none shadow-sm transition-all dark:bg-slate-800 dark:text-white ${network.online ? 'border-gray-200 dark:border-slate-700 focus:border-pop-green' : 'border-orange-300 bg-orange-50 text-orange-900 focus:border-orange-500'}`}
              value={query} onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]) }} className="absolute right-3 top-3 text-gray-400 hover:text-red-500"><X size={20} /></button>
            )}
        </div>
        
        {/* TOMBOL MANUAL (BARU) */}
        <button 
          onClick={() => setShowManual(true)}
          className="bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 p-3 rounded-xl border border-blue-200 dark:border-slate-600 hover:bg-blue-100"
        >
          <PenTool size={24} />
        </button>

        {/* TOMBOL SCANNER */}
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-200 p-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-200"
        >
          <ScanLine size={24} />
        </button>
      </div>

      {/* --- MODAL INPUT MANUAL (BARU) --- */}
      {showManual && (
        <div className="fixed inset-0 z-[99999] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl space-y-4">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <PenTool size={18}/> Input Manual
                    </h3>
                    <button onClick={() => setShowManual(false)} className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-full p-2"><X size={20} /></button>
                 </div>

                 <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Nama Produk / Jasa</label>
                        <input 
                            autoFocus
                            className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Contoh: Ongkir / Titipan"
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Harga (Rp)</label>
                        <input 
                            type="number"
                            className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            value={manualPrice}
                            onChange={e => setManualPrice(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-lg flex justify-center items-center gap-2">
                        <Check size={20}/> Tambahkan
                    </button>
                 </form>
            </div>
        </div>
      )}

      {/* MODAL SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm relative shadow-2xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-800">Scan Barcode</h3>
                <button onClick={() => setShowScanner(false)} className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-full p-2"><X size={20} /></button>
             </div>
             <div className="rounded-xl overflow-hidden bg-black border-2 border-gray-200"><div id="reader" className="w-full"></div></div>
             <p className="text-center text-xs text-gray-500 mt-4">Arahkan kamera ke barcode produk</p>
          </div>
        </div>
      )}

      {/* HASIL SEARCH */}
      {results.length > 0 && (
        <div className="absolute left-4 right-4 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 max-h-60 overflow-y-auto z-50">
          {results.map((product) => (
            <div key={product.id} onClick={() => { onAddProduct(product); setQuery(''); setResults([]) }}
              className="p-3 border-b dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center">
               <div><div className="font-bold dark:text-white">{product.name}</div><div className="text-xs text-gray-500 flex items-center gap-1"><Barcode size={12}/> {product.barcode || '-'}</div></div>
               <div className="font-bold text-pop-green">Rp {product.price.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}