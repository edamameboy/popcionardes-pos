'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { Plus, Search, Trash2, Upload, FileSpreadsheet, Edit, X, Save, AlertTriangle } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false) // State Admin

  // State untuk Edit Modal
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

    // Cek Role Admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      setIsAdmin(true)
    }

    fetchProducts()
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setProducts(data)
    setLoading(false)
  }

  // --- LOGIKA HAPUS (DELETE) ---
  const deleteProduct = async (id: number) => {
    if (!isAdmin) return alert("Akses Ditolak: Hanya Admin.")
    
    if (confirm('Yakin ingin menghapus produk ini selamanya?')) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      
      if (error) {
        // Error biasanya karena Foreign Key (Produk sudah pernah terjual)
        if (error.message.includes('foreign key')) {
            alert("GAGAL: Produk ini sudah ada di riwayat transaksi penjualan. Tidak bisa dihapus demi data laporan.")
        } else {
            alert('Gagal menghapus: ' + error.message)
        }
      } else {
        fetchProducts() // Refresh
      }
    }
  }

  // --- LOGIKA EDIT (UPDATE) ---
  const handleEditClick = (product: any) => {
    setEditingProduct(product) // Buka Modal
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    const { error } = await supabase
        .from('products')
        .update({
            name: editingProduct.name,
            price: editingProduct.price,
            stock: editingProduct.stock,
            barcode: editingProduct.barcode,
            description: editingProduct.description
        })
        .eq('id', editingProduct.id)

    if (error) {
        alert("Gagal update: " + error.message)
    } else {
        alert("Produk berhasil diupdate!")
        setEditingProduct(null) // Tutup Modal
        fetchProducts() // Refresh
    }
  }

  // --- LOGIKA IMPORT CSV (TETAP SAMA) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)

    Papa.parse(file, {
      header: true, 
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        const formattedData = rows.map((row: any) => {
          const nama = row['nama produk'] || row['name']
          const harga = parseInt(row['harga'] || row['price'] || '0')
          const qty = parseInt(row['qty'] || row['stock'] || '0')
          const barcode = row['barcode'] ? String(row['barcode']) : null
          const sku = row['sku'] ? String(row['sku']) : ''

          if (!nama || harga <= 0) return null

          return {
            name: nama,
            price: harga,
            stock: qty,
            barcode: barcode,  
            sku: sku ? `SKU: ${sku}` : '' 
          }
        }).filter(item => item !== null)

        if (formattedData.length === 0) {
          alert('Gagal! Format CSV salah.')
          setIsUploading(false)
          return
        }

        const { error } = await supabase.from('products').insert(formattedData)
        if (error) alert('Gagal Upload: ' + error.message)
        else {
            alert(`Sukses import ${formattedData.length} produk!`)
            fetchProducts()
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

  const downloadTemplate = () => {
    const csvContent = "barcode,sku,nama produk,qty,harga\n8991001,FUNKO-001,Funko Pop Luffy,12,250000"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "template_stok.csv"
    link.click()
  }

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.includes(search)) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory</h1>
        
        <div className="flex flex-col md:flex-row gap-3">
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

            {/* Tombol Action (Hanya Admin yang bisa lihat tombol Import/Add) */}
            {isAdmin && (
                <div className="flex gap-2">
                    <button 
                    onClick={() => router.push('/inventory/add')}
                    className="bg-pop-green hover:bg-pop-green-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                    >
                    <Plus size={20} /> <span className="hidden md:inline">Baru</span>
                    </button>

                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                    >
                    {isUploading ? <span className="animate-spin">⏳</span> : <Upload size={20} />} 
                    <span className="hidden md:inline">CSV</span>
                    </button>

                    <button onClick={downloadTemplate} className="bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg">
                        <FileSpreadsheet size={20} />
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-slate-700 overflow-hidden">
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
                    <div className="text-xs text-blue-500">{product.description || ''}</div>
                  </td>
                  <td className="p-4 dark:text-gray-300">Rp {product.price.toLocaleString()}</td>
                  <td className={`p-4 text-center font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                    {product.stock}
                  </td>
                  
                  {/* KOLOM AKSI (KHUSUS ADMIN) */}
                  {isAdmin && (
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => handleEditClick(product)}
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

      {/* --- MODAL EDIT PRODUK --- */}
      {editingProduct && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white">Edit Produk</h3>
                    <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
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
                                value={editingProduct.description || ''}
                                onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium">
                            Batal
                        </button>
                        <button type="submit" className="flex-1 py-3 bg-pop-green hover:bg-pop-green-dark text-white rounded-xl font-bold flex items-center justify-center gap-2">
                            <Save size={18}/> Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  )
}