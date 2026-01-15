'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, X, Barcode, ScanLine, XCircle } from 'lucide-react' // Icon ScanLine
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'
import { Html5QrcodeScanner } from 'html5-qrcode' // Library Scanner

export default function ProductInput({ onAddProduct }: { onAddProduct: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false) // State untuk kamera scan
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const supabase = createClient()
  const network = useNetwork()

  // --- LOGIKA SCANNER KAMERA ---
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        false
      );

      scanner.render(
        (decodedText) => {
          // Jika berhasil scan
          setQuery(decodedText) // Masukkan teks ke input
          scanner.clear() // Matikan kamera
          setShowScanner(false) // Tutup modal
        },
        (error) => {
          // console.warn(error) // Abaikan error scanning frame kosong
        }
      );

      // Cleanup saat close
      return () => {
        scanner.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    }
  }, [showScanner])


  // --- LOGIKA PENCARIAN (Sama seperti sebelumnya) ---
  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    searchTimeout.current = setTimeout(async () => {
      setLoading(true)
      
      try {
        let onlineResults: any[] = []
        let errorOnline = null

        if (network.online) {
          try {
            const { data, error } = await supabase
              .from('products')
              .select('*')
              .or(`name.ilike.%${query}%,description.ilike.%${query}%,barcode.ilike.%${query}%`)
              .limit(10)
            
            if (error) throw error
            if (data) onlineResults = data
          } catch (err) {
            errorOnline = err
          }
        }

        if (!network.online || onlineResults.length === 0 || errorOnline) {
           const keyword = query.toLowerCase()
           const localData = await db.products
            .filter(p => 
               p.name.toLowerCase().includes(keyword) || 
               (p.barcode && p.barcode.includes(keyword)) ||
               (p.description && p.description.toLowerCase().includes(keyword)) || false
            )
            .limit(10)
            .toArray()
            
           setResults(localData)
        } else {
           setResults(onlineResults)
        }

      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }

    }, 500)

    return () => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [query, network.online])

  // --- AUTO ADD JIKA HASIL SCAN CUMA 1 ---
  useEffect(() => {
    // Fitur: Jika hasil scan barcode presisi (cuma 1 hasil), langsung masuk keranjang
    if (query && results.length === 1 && !loading) {
       // Cek apakah input query sama persis dengan barcode produk
       if (results[0].barcode === query) {
         onAddProduct(results[0])
         setQuery('')
         setResults([])
       }
    }
  }, [results, loading, query])

  return (
    <div className="p-4 relative z-20">
      
      {/* INPUT BAR */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
            <div className="absolute left-3 top-3 text-gray-400">
            {loading ? <span className="animate-spin">⏳</span> : <Search size={20} />}
            </div>
            
            <input 
            type="text" 
            placeholder="Ketik / Scan Barcode..."
            className={`w-full pl-10 pr-10 p-3 rounded-xl border outline-none shadow-sm transition-all dark:bg-slate-800 dark:text-white ${
                network.online 
                ? 'border-gray-200 dark:border-slate-700 focus:border-pop-green' 
                : 'border-orange-300 bg-orange-50 text-orange-900 focus:border-orange-500'
            }`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            />
            
            {query && (
            <button 
                onClick={() => { setQuery(''); setResults([]) }} 
                className="absolute right-3 top-3 text-gray-400 hover:text-red-500"
            >
                <X size={20} />
            </button>
            )}
        </div>

        {/* TOMBOL SCANNER KAMERA */}
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-200 p-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-200"
        >
          <ScanLine size={24} />
        </button>
      </div>

      {/* MODAL SCANNER KAMERA */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm relative">
             <button 
               onClick={() => setShowScanner(false)}
               className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full p-2"
             >
               <XCircle size={24} />
             </button>
             <h3 className="text-center font-bold mb-4">Scan Barcode Produk</h3>
             <div id="reader" className="w-full"></div>
          </div>
        </div>
      )}

      {/* HASIL PENCARIAN */}
      {results.length > 0 && (
        <div className="absolute left-4 right-4 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 max-h-60 overflow-y-auto z-50">
          {results.map((product) => (
            <div 
              key={product.id}
              onClick={() => {
                onAddProduct(product)
                setQuery('')
                setResults([])
              }}
              className="p-3 border-b dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center"
            >
               <div>
                  <div className="font-bold dark:text-white">{product.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                     <Barcode size={12}/> {product.barcode || '-'}
                  </div>
               </div>
               <div className="font-bold text-pop-green">Rp {product.price.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}