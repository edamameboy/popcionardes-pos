'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { Plus, Search, Trash2, Upload, FileSpreadsheet } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setProducts(data)
    setLoading(false)
  }

  const deleteProduct = async (id: number) => {
    if (confirm('Hapus produk ini?')) {
      await supabase.from('products').delete().eq('id', id)
      fetchProducts()
    }
  }

  // --- LOGIKA IMPORT CSV TERBARU ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    Papa.parse(file, {
      header: true, // Wajib ada header
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        
        // Mapping kolom CSV (Bahasa Indonesia) ke Database Supabase
        const formattedData = rows.map((row: any) => {
          // Ambil data berdasarkan nama kolom yang diminta
          const nama = row['nama produk'] || row['name']
          const harga = parseInt(row['harga'] || row['price'] || '0')
          const qty = parseInt(row['qty'] || row['stock'] || '0')
          const barcode = row['barcode'] ? String(row['barcode']) : null
          const sku = row['sku'] ? String(row['sku']) : ''

          // Validasi sederhana
          if (!nama || harga <= 0) return null

          return {
            name: nama,
            price: harga,
            stock: qty,
            barcode: barcode, 
            category: 'Umum', // Default category
            // Karena tabel belum ada kolom SKU, kita simpan di description
            description: sku ? `SKU: ${sku}` : '' 
          }
        }).filter(item => item !== null) // Buang baris yang invalid (tidak ada nama/harga 0)

        if (formattedData.length === 0) {
          alert('Gagal! Pastikan nama kolom di CSV adalah: barcode, sku, nama produk, qty, harga')
          setIsUploading(false)
          return
        }

        // Upload ke Supabase
        const { error } = await supabase.from('products').insert(formattedData)

        if (error) {
          alert('Gagal Upload Database: ' + error.message)
        } else {
          alert(`Sukses! ${formattedData.length} produk berhasil diimport.`)
          fetchProducts() // Refresh table
        }
        
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = '' 
      },
      error: (error) => {
        alert('Error file: ' + error.message)
        setIsUploading(false)
      }
    })
  }

  // Download Template sesuai permintaan user
  const downloadTemplate = () => {
    // Header persis seperti permintaan
    const csvContent = "barcode,sku,nama produk,qty,harga\n8991001,FUNKO-001,Funko Pop Luffy,12,250000\n8991002,FUNKO-002,Funko Pop Naruto,5,275000"
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "template_stok_popcionardes.csv"
    link.click()
  }

  // Filter pencarian
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.includes(search)) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase())) // Bisa cari by SKU juga
  )

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory</h1>
        
        <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Cari Nama / Barcode / SKU..." 
                  className="w-full pl-10 p-2.5 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="flex gap-2">
                <button 
                  onClick={() => router.push('/inventory/add')}
                  className="bg-pop-green hover:bg-pop-green-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                >
                  <Plus size={20} /> <span className="hidden md:inline">Manual</span>
                </button>

                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                >
                  {isUploading ? <span className="animate-spin">⏳</span> : <Upload size={20} />} 
                  <span className="hidden md:inline">{isUploading ? 'Proses...' : 'Import Excel/CSV'}</span>
                </button>

                <button 
                  onClick={downloadTemplate}
                  className="bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center gap-2"
                  title="Download Template"
                >
                   <FileSpreadsheet size={20} />
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="p-4">Produk</th>
              <th className="p-4">SKU / Barcode</th>
              <th className="p-4">Harga</th>
              <th className="p-4 text-center">Qty</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={5} className="p-8 text-center">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
               <tr><td colSpan={5} className="p-8 text-center text-gray-500">Produk tidak ditemukan</td></tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="p-4 font-bold dark:text-white">{product.name}</td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    <div>{product.barcode || '-'}</div>
                    {/* Tampilkan SKU dari kolom deskripsi */}
                    <div className="text-xs text-blue-500">{product.description?.includes('SKU:') ? product.description : ''}</div>
                  </td>
                  <td className="p-4 dark:text-gray-300">Rp {product.price.toLocaleString()}</td>
                  <td className={`p-4 text-center font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                    {product.stock}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => deleteProduct(product.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}