'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { Plus, Search, Trash2, Upload, Download, Edit, X, Save, Barcode, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  
  // STATE BARU: Konfigurasi Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUserAndFetch()
  }, [])

  const checkUserAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') setIsAdmin(true)
    
    fetchProducts()
  }

  const fetchProducts = async () => {
    // Awal load default berdasarkan nama
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setProducts(data)
    setLoading(false)
  }

  const deleteProduct = async (id: number) => {
    if (!isAdmin) return alert("Akses Ditolak: Hanya Admin.")
    if (confirm('Hapus produk ini?')) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) {
        if (error.message.includes('foreign key')) alert("GAGAL: Produk sudah ada di riwayat transaksi.")
        else alert('Gagal: ' + error.message)
      } else fetchProducts()
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    const { error } = await supabase.from('products').update({
        name: editingProduct.name, price: editingProduct.price,
        stock: editingProduct.stock, barcode: editingProduct.barcode, description: editingProduct.description
    }).eq('id', editingProduct.id)
    
    if (error) alert("Gagal update: " + error.message)
    else { alert("Sukses!"); setEditingProduct(null); fetchProducts() }
  }

  const handleExportCSV = () => {
    if (products.length === 0) return alert("Belum ada data untuk diexport.")
    const csvData = products.map(p => {
      const cleanSku = p.description ? p.description.replace('SKU: ', '') : ''
      return {
        'id': p.id, 'barcode': p.barcode || '', 'sku': cleanSku,
        'nama produk': p.name, 'qty': p.stock, 'harga': p.price
      }
    })
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Data_Produk_${new Date().toISOString().split('T')[0]}.csv`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsUploading(true)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        const formattedData = rows.map((row: any) => {
          const rawId = row['id']; const rawNama = row['nama produk'] || row['name']
          const rawHarga = row['harga'] || row['price']; const rawQty = row['qty'] || row['stock']
          const cleanNumber = (val: any) => parseInt(String(val).replace(/[^0-9]/g, '')) || 0
          const harga = cleanNumber(rawHarga); const qty = cleanNumber(rawQty)
          if (!rawNama || harga <= 0) return null
          const productObj: any = { name: rawNama, price: harga, stock: qty, barcode: row['barcode'] ? String(row['barcode']) : null, description: row['sku'] ? `SKU: ${row['sku']}` : '' }
          if (rawId) productObj.id = parseInt(rawId)
          return productObj
        }).filter(item => item !== null) 

        if (formattedData.length === 0) { alert('Gagal! Tidak ada data valid.'); setIsUploading(false); return }
        const { error } = await supabase.from('products').upsert(formattedData)
        if (error) alert('Gagal Upload: ' + error.message)
        else { alert(`Sukses import & edit ${formattedData.length} produk!`); fetchProducts() }
        setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' 
      },
      error: (error) => { alert('Error membaca file: ' + error.message); setIsUploading(false) }
    })
  }

  // --- LOGIKA FILTER & SORTING ---
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 opacity-50" />
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
  }

  const processedData = useMemo(() => {
    // 1. Filter Pencarian Dulu
    let filtered = products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.barcode && p.barcode.includes(search))
    )

    // 2. Terapkan Sorting
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return filtered
  }, [products, search, sortConfig])


  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors select-none">
      
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory</h1>
        
        <div className="flex flex-col gap-3">
            {/* Input Cari & Dropdown Sort Mobile */}
            <div className="flex gap-2 w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input 
                    type="text" 
                    placeholder="Cari Produk..." 
                    className="w-full pl-10 p-2.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-pop-green"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    />
                </div>
                
                {/* Opsi Sort untuk Mobile (Tampil di semua layar tapi sangat berguna di Mobile) */}
                <select 
                    className="border p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 outline-none focus:ring-2 focus:ring-pop-green w-32 md:w-40"
                    onChange={(e) => {
                        const val = e.target.value
                        if (!val) setSortConfig(null)
                        else {
                            const [key, dir] = val.split('-')
                            setSortConfig({ key, direction: dir as 'asc'|'desc' })
                        }
                    }}
                >
                    <option value="">Urutkan...</option>
                    <option value="name-asc">A - Z</option>
                    <option value="name-desc">Z - A</option>
                    <option value="price-desc">Harga Tertinggi</option>
                    <option value="price-asc">Harga Terendah</option>
                    <option value="stock-asc">Stok Menipis</option>
                    <option value="stock-desc">Stok Terbanyak</option>
                </select>
            </div>

            {isAdmin && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button onClick={() => router.push('/inventory/add')} className="bg-pop-green hover:bg-pop-green-dark text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold whitespace-nowrap shadow-sm">
                        <Plus size={20} /> <span className="hidden md:inline">Baru</span>
                    </button>
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold whitespace-nowrap shadow-sm">
                        {isUploading ? <span className="animate-spin">⏳</span> : <Upload size={20} />} <span className="hidden md:inline">Import CSV</span>
                    </button>
                    <button onClick={handleExportCSV} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold whitespace-nowrap shadow-sm">
                        <Download size={20} /> <span className="hidden md:inline">Export</span>
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading ? <div className="text-center py-10 text-gray-500">Memuat...</div> : 
         processedData.length === 0 ? <div className="text-center py-10 text-gray-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">Produk Kosong</div> :
         processedData.map((product) => (
            <div key={product.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="font-bold text-lg dark:text-white">{product.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Barcode size={12}/> {product.barcode || '-'} 
                            {product.description && <span className="text-blue-500 ml-2">{product.description}</span>}
                        </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${product.stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        Stok: {product.stock}
                    </div>
                </div>
                
                <div className="flex justify-between items-center border-t dark:border-slate-700 pt-3 mt-2">
                    <div className="font-bold text-gray-700 dark:text-gray-200">Rp {product.price.toLocaleString()}</div>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <button onClick={() => setEditingProduct(product)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={18}/></button>
                            <button onClick={() => deleteProduct(product.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={18}/></button>
                        </div>
                    )}
                </div>
            </div>
         ))
        }
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-b dark:border-slate-700">
            <tr>
              {/* HEADER BISA DI-KLIK */}
              <th className="p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('name')}>
                <div className="flex items-center gap-2">Produk <span className="group-hover:opacity-100 transition-opacity">{getSortIcon('name')}</span></div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('price')}>
                <div className="flex items-center gap-2">Harga <span className="group-hover:opacity-100 transition-opacity">{getSortIcon('price')}</span></div>
              </th>
              <th className="p-4 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('stock')}>
                <div className="flex items-center justify-center gap-2">Stok <span className="group-hover:opacity-100 transition-opacity">{getSortIcon('stock')}</span></div>
              </th>
              {isAdmin && <th className="p-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={isAdmin ? 4 : 3} className="p-8 text-center text-gray-500">Memuat...</td></tr>
            ) : processedData.length === 0 ? (
               <tr><td colSpan={isAdmin ? 4 : 3} className="p-8 text-center text-gray-500">Produk tidak ditemukan</td></tr>
            ) : (
              processedData.map((product) => (
                <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="p-4">
                    <div className="font-bold dark:text-white">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.barcode || '-'}</div>
                    <div className="text-xs text-blue-500">{product.description || ''}</div>
                  </td>
                  <td className="p-4 dark:text-gray-300 font-medium">Rp {product.price.toLocaleString()}</td>
                  <td className={`p-4 text-center font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                    {product.stock}
                  </td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingProduct(product)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400">
                            <Edit size={18} />
                        </button>
                        <button onClick={() => deleteProduct(product.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400">
                            <Trash2 size={18} />
                        </button>
                        </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL EDIT */}
      {editingProduct && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white">Edit Produk</h3>
                    <button onClick={() => setEditingProduct(null)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nama Produk</label>
                        <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Harga (Rp)</label>
                            <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Stok</label>
                            <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Barcode</label>
                            <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.barcode || ''} onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Deskripsi / SKU</label>
                            <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-pop-green hover:bg-pop-green-dark text-white rounded-xl font-bold flex justify-center gap-2 mt-4 transition-colors">
                        <Save size={18}/> Simpan Perubahan
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}