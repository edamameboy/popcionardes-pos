'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, X, Barcode } from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork' // <-- Hook Sinyal
import { db } from '@/utils/db' // <-- Database Lokal

export default function ProductInput({ onAddProduct }: { onAddProduct: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const supabase = createClient()
  const network = useNetwork() // Cek status online/offline

  // Efek Pencarian (Debounce)
  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    searchTimeout.current = setTimeout(async () => {
      setLoading(true)
      
      try {
        if (network.online) {
          // === MODE ONLINE: Cari ke Supabase ===
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`name.ilike.%${query}%,barcode.eq.${query},description.ilike.%${query}%`) // Cari Nama, Barcode, atau SKU (deskripsi)
            .limit(10)
          
          if (data) setResults(data)
          
        } else {
          // === MODE OFFLINE: Cari ke Dexie (Lokal) ===
          const keyword = query.toLowerCase()
          
          // Cari manual di array lokal (Dexie filter)
          const localData = await db.products
            .filter(p => 
               p.name.toLowerCase().includes(keyword) || 
               (p.barcode === keyword) ||
               (p.description && p.description.toLowerCase().includes(keyword)) || false
            )
            .limit(10)
            .toArray()
            
          setResults(localData)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }

    }, 500) // Delay 500ms biar ga spam

    return () => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [query, network.online])

  // Fungsi Scan Barcode (Simulasi tekan Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      // Jika hasil cuma 1 (scan barcode pas), langsung masuk keranjang
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
          placeholder={network.online ? "Cari Produk / Scan Barcode..." : "Mode Offline: Cari Produk Lokal..."}
          className={`w-full pl-10 pr-10 p-3 rounded-xl border outline-none shadow-sm transition-all ${
             network.online 
               ? 'border-gray-200 dark:border-slate-700 focus:border-pop-green focus:ring-2 focus:ring-pop-green/20' 
               : 'border-red-300 bg-red-50 focus:border-red-500 text-red-900'
          } dark:bg-slate-800 dark:text-white`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
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

      {/* Dropdown Hasil Pencarian */}
      {results.length > 0 && (
        <div className="absolute left-4 right-4 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {results.map((product) => (
            <div 
              key={product.id}
              onClick={() => {
                onAddProduct(product)
                setQuery('') // Reset input setelah pilih
                setResults([])
              }}
              className="p-3 border-b dark:border-slate-700 hover:bg-pop-green-light dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center group"
            >
              <div>
                <div className="font-bold text-gray-800 dark:text-white group-hover:text-pop-green-dark">
                    {product.name}
                </div>
                <div className="text-xs text-gray-500 flex gap-2">
                   {product.barcode && <span className="flex items-center gap-1"><Barcode size={10}/> {product.barcode}</span>}
                   <span className={product.stock > 0 ? 'text-green-600' : 'text-red-500'}>
                     Stok: {product.stock}
                   </span>
                </div>
              </div>
              <div className="font-bold text-pop-green">
                Rp {product.price.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Pesan jika tidak ketemu */}
      {query && results.length === 0 && !loading && (
         <div className="absolute left-4 right-4 mt-2 bg-white dark:bg-slate-800 p-3 rounded-xl shadow text-center text-sm text-gray-500 border dark:border-slate-700">
            Produk tidak ditemukan {network.online ? '' : '(Mode Offline)'}
         </div>
      )}
    </div>
  )
}