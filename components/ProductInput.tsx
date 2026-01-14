'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, X, Barcode } from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'

export default function ProductInput({ onAddProduct }: { onAddProduct: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const supabase = createClient()
  const network = useNetwork()

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

        // 1. COBA CARI ONLINE DULU (Jika Sinyal Ada)
        if (network.online) {
          try {
            const { data, error } = await supabase
              .from('products')
              .select('*')
              // Menggunakan filter teks sederhana agar tidak error tipe data
              .or(`name.ilike.%${query}%,description.ilike.%${query}%,barcode.ilike.%${query}%`)
              .limit(10)
            
            if (error) throw error
            if (data) onlineResults = data
          } catch (err) {
            console.warn("Gagal cari online, beralih ke lokal...", err)
            errorOnline = err
          }
        }

        // 2. JIKA ONLINE KOSONG ATAU OFFLINE ATAU ERROR, CARI DI LOKAL
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      if (results.length === 1) {
        onAddProduct(results[0])
        setQuery('')
        setResults([])
      }
    }
  }

  return (
    <div className="p-4 relative z-20">
      <div className="relative">
        <div className="absolute left-3 top-3 text-gray-400">
           {loading ? <span className="animate-spin">⏳</span> : <Search size={20} />}
        </div>
        
        <input 
          type="text" 
          placeholder="Cari Produk / Scan Barcode..."
          className={`w-full pl-10 pr-10 p-3 rounded-xl border outline-none shadow-sm transition-all dark:bg-slate-800 dark:text-white ${
             network.online 
               ? 'border-gray-200 dark:border-slate-700 focus:border-pop-green' 
               : 'border-orange-300 bg-orange-50 text-orange-900 focus:border-orange-500'
          }`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        
        {/* ... (Sisa kode tampilan sama seperti sebelumnya) ... */}
         {query && (
          <button 
            onClick={() => { setQuery(''); setResults([]) }} 
            className="absolute right-3 top-3 text-gray-400 hover:text-red-500"
          >
            <X size={20} />
          </button>
        )}
      </div>

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
                  <div className="text-xs text-gray-500">{product.barcode || '-'}</div>
               </div>
               <div className="font-bold text-pop-green">Rp {product.price.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}