'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' // Library pembaca CSV
import { Plus, Search, Trash2, Upload, FileSpreadsheet, Edit, X, Save, Barcode } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false) // State loading upload
  const [isAdmin, setIsAdmin] = useState(false)

  // State Edit
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  
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
        stock: editingProduct.stock, barcode: editingProduct.barcode, sku: editingProduct.sku
    }).eq('id', editingProduct.id)
    
    if (error) alert("Gagal update: " + error.message)
    else { alert("Sukses!"); setEditingProduct(null); fetchProducts() }
  }

  // --- FUNGSI 1: DOWNLOAD TEMPLATE CSV ---
  const downloadTemplate = () => {
    // Header CSV + 1 Contoh Data Dummy
    const csvContent = "barcode,sku,nama produk,qty,harga\n8991001,FUNKO-001,Funko Pop Luffy,12,250000"
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    
    link.setAttribute("href", url)
    link.setAttribute("download", "template_upload_stok.csv")
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- FUNGSI 2: UPLOAD & PROCESS CSV (SUDAH DIPERBAIKI) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    Papa.parse(file, {
      header: true, // Baris pertama dianggap judul kolom
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        
        // Mapping data dari CSV ke format Database Supabase
        const formattedData = rows.map((row: any) => {
          // 1. Ambil data mentah (Mapping nama kolom CSV)
          const rawNama = row['nama produk'] || row['name']
          const rawHarga = row['harga'] || row['price']
          const rawQty = row['qty'] || row['stock']
          const rawBarcode = row['barcode']
          const rawSku = row['sku']

          // 2. Helper: Bersihkan Angka (Hapus "Rp", ".", ",", spasi)
          const cleanNumber = (val: any) => {
            if (!val) return 0
            // Hapus semua karakter KECUALI angka 0-9
            const cleanStr = String(val).replace(/[^0-9]/g, '')
            return parseInt(cleanStr) || 0
          }

          const harga = cleanNumber(rawHarga)
          const qty = cleanNumber(rawQty)

          // 3. Validasi Wajib: Nama ada & Harga > 0
          if (!rawNama || harga <= 0) return null

          // 4. Return Object (Tanpa 'category', sku masuk ke 'sku')
          return {
            name: rawNama,
            price: harga,
            stock: qty,
            barcode: rawBarcode ? String(rawBarcode) : null,
            sku: rawSku ? `SKU: ${rawSku}` : '' 
          }
        }).filter(item => item !== null) // Hapus baris yang kosong/error

        if (formattedData.length === 0) {
          alert('Gagal! Tidak ada data valid. Pastikan format CSV benar dan harga berupa angka.')
          setIsUploading(false)
          return
        }

        // Simpan Massal ke Supabase
        const { error } = await supabase.from('products').insert(formattedData)

        if (error) {
            alert('Gagal Upload: ' + error.message)
        } else {
            alert(`Sukses import ${formattedData.length} produk!`)
            fetchProducts() // Refresh table
        }
        
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = '' // Reset input file
      },
      error: (error) => {
        alert('Error membaca file: ' + error.message)
        setIsUploading(false)
      }
    })
  }

  // Filter Pencarian
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.includes(search))
  )

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory</h1>
        
        <div className="flex flex-col md:flex-row gap-3">
            {/* Input Cari */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Cari Nama / Barcode..." 
                  className="w-full pl-10 p-2.5 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Tombol Action Group */}
            {isAdmin && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {/* 1. Tombol Tambah Manual */}
                    <button 
                    onClick={() => router.push('/inventory/add')}
                    className="bg-pop-green hover:bg-pop-green-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium whitespace-nowrap"
                    >
                    <Plus size={20} /> <span className="hidden md:inline">Baru</span>
                    </button>

                    {/* 2. Tombol Upload CSV (Hidden Input + Label Button) */}
                    <input 
                        type="file" 
                        accept=".csv" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden" 
                    />
                    <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium whitespace-nowrap"
                    >
                    {isUploading ? <span className="animate-spin">⏳</span> : <Upload size={20} />} 
                    <span className="hidden md:inline">CSV</span>
                    </button>

                    {/* 3. Tombol Download Template */}
                    <button 
                        onClick={downloadTemplate}
                        className="bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center gap-2"
                        title="Download Template Excel/CSV"
                    >
                        <FileSpreadsheet size={20} />
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading ? <div className="text-center py-10">Memuat...</div> : 
         filtered.length === 0 ? <div className="text-center py-10 text-gray-400">Kosong</div> :
         filtered.map((product) => (
            <div key={product.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="font-bold text-lg dark:text-white">{product.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Barcode size={12}/> {product.barcode || '-'} 
                            {product.sku && <span className="text-blue-500 ml-2">{product.sku}</span>}
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
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="p-4">Produk</th>
              <th className="p-4">Harga</th>
              <th className="p-4 text-center">Stok</th>
              {isAdmin && <th className="p-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={isAdmin ? 4 : 3} className="p-8 text-center">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
               <tr><td colSpan={isAdmin ? 4 : 3} className="p-8 text-center text-gray-500">Produk tidak ditemukan</td></tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="p-4">
                    <div className="font-bold dark:text-white">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.barcode || '-'}</div>
                    <div className="text-xs text-blue-500">{product.sku || ''}</div>
                  </td>
                  <td className="p-4 dark:text-gray-300">Rp {product.price.toLocaleString()}</td>
                  <td className={`p-4 text-center font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                    {product.stock}
                  </td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => setEditingProduct(product)} 
                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400"
                        >
                            <Edit size={18} />
                        </button>
                        <button 
                            onClick={() => deleteProduct(product.id)} 
                            className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400"
                        >
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
                        <label className="text-sm text-gray-500 dark:text-gray-400">Nama Produk</label>
                        <input 
                            className="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                            value={editingProduct.name}
                            onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400">Harga (Rp)</label>
                            <input 
                                type="number"
                                className="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                value={editingProduct.price}
                                onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400">Stok</label>
                            <input 
                                type="number"
                                className="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                value={editingProduct.stock}
                                onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400">Barcode</label>
                            <input 
                                className="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                value={editingProduct.barcode || ''}
                                onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500 dark:text-gray-400">Deskripsi / SKU</label>
                            <input 
                                className="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                value={editingProduct.sku || ''}
                                onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})}
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 bg-pop-green hover:bg-pop-green-dark text-white rounded-xl font-bold flex justify-center gap-2 mt-4">
                        <Save size={18}/> Simpan Perubahan
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}