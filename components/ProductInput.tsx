'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, Barcode, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import Scanner from './Scanner'

interface ProductInputProps {
  onAddProduct: (product: any) => void
}

export default function ProductInput({ onAddProduct }: ProductInputProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([]) // Menyimpan hasil pencarian
  const [showScanner, setShowScanner] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Ref untuk debounce (jeda pencarian)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // 1. Fungsi Pencarian Otomatis saat mengetik
  useEffect(() => {
    // Jika query kosong, bersihkan saran
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    setLoading(true)

    // Clear timeout sebelumnya jika user masih mengetik (Debounce)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Set timeout baru (tunggu 300ms setelah user berhenti mengetik)
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`) // Cari Nama ATAU SKU
        .limit(5) // Batasi 5 hasil saja biar rapi
      
      setSuggestions(data || [])
      setLoading(false)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // 2. Fungsi Add Product Langsung (Enter atau Scan)
  const handleDirectSearch = async (keyword: string) => {
    if (!keyword) return
    
    // Matikan loading UI pencarian dropdown karena kita force search
    setSuggestions([]) 

    const { data } = await supabase
      .from('products')
      .select('*')
      .or(`sku.eq.${keyword},barcode.eq.${keyword},name.ilike.%${keyword}%`)
      .maybeSingle()
    
    if (data) {
      onAddProduct(data)
      setQuery('')
      setShowScanner(false)
    } else {
      alert(`Produk "${keyword}" tidak ditemukan.`)
    }
  }

  // 3. Fungsi saat Item di Dropdown di-klik
  const handleSelectSuggestion = (product: any) => {
    onAddProduct(product)
    setQuery('')
    setSuggestions([]) // Tutup dropdown
  }

  return (
    <>
      <div className="p-4 bg-white shadow sticky top-0 z-40">
        <div className="flex gap-2 relative"> {/* Relative untuk positioning dropdown */}
          
          <div className="relative w-full">
            <input 
              type="text" 
              placeholder="Ketik nama produk..."
              className="border border-gray-300 p-3 pl-10 rounded-lg w-full text-black"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDirectSearch(query)}
            />
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            
            {/* Tombol Clear Text (X) muncul jika ada ketikan */}
            {query && (
              <button 
                onClick={() => { setQuery(''); setSuggestions([]); }}
                className="absolute right-3 top-3 text-gray-400 hover:text-red-500"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <button 
            onClick={() => setShowScanner(true)} 
            className="bg-blue-600 text-white p-3 rounded-lg min-w-[50px] flex justify-center items-center"
          >
            <Barcode size={24} />
          </button>

          {/* --- DROPDOWN HASIL PENCARIAN --- */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
              <ul>
                {suggestions.map((item) => (
                  <li 
                    key={item.id}
                    onClick={() => handleSelectSuggestion(item)}
                    className="flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                  >
                    {/* Gambar Kecil */}
                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No IMG</div>
                      )}
                    </div>
                    
                    {/* Detail Produk */}
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        Rp {item.price.toLocaleString()} • Stok: {item.stock}
                      </p>
                    </div>

                    {/* Indikator Tambah */}
                    <div className="text-blue-600 text-xs font-bold bg-blue-100 px-2 py-1 rounded">
                      + ADD
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
           
           {/* Pesan jika loading lama atau tidak ketemu (Opsional) */}
           {loading && suggestions.length === 0 && (
             <div className="absolute top-full left-0 w-full bg-white p-2 text-xs text-gray-400 text-center italic border shadow-lg mt-1 rounded">
               Mencari...
             </div>
           )}

        </div>
      </div>

      {showScanner && (
        <Scanner 
          onScanSuccess={(code) => handleDirectSearch(code)}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  )
}