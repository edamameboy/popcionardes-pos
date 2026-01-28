'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { Plus, Search, Trash2, Upload, FileSpreadsheet, Edit, X, Save, MoreVertical, Package, Barcode } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // State Edit
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { checkUserAndFetch() }, [])

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
        stock: editingProduct.stock, barcode: editingProduct.barcode, description: editingProduct.description
    }).eq('id', editingProduct.id)
    
    if (error) alert("Gagal update: " + error.message)
    else { alert("Sukses!"); setEditingProduct(null); fetchProducts() }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsUploading(true)
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (results) => {
        const rows = results.data
        const formattedData = rows.map((row: any) => {
          const nama = row['nama produk'] || row['name']; const harga = parseInt(row['harga'] || row['price'] || '0')
          const qty = parseInt(row['qty'] || row['stock'] || '0'); 
          if (!nama || harga <= 0) return null
          return { name: nama, price: harga, stock: qty, barcode: row['barcode'] || null, category: 'Umum', description: row['sku'] || '' }
        }).filter((item: any) => item !== null)
        
        if (formattedData.length === 0) { alert('Format CSV salah'); setIsUploading(false); return }
        const { error } = await supabase.from('products').insert(formattedData)
        if (error) alert('Gagal Upload: ' + error.message); else { alert(`Sukses import ${formattedData.length} item!`); fetchProducts() }
        setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' 
      }
    })
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)))

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory</h1>
        <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input type="text" placeholder="Cari Produk..." className="w-full pl-10 p-2.5 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                  value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {isAdmin && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button onClick={() => router.push('/inventory/add')} className="bg-pop-green text-white px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"><Plus size={20}/> Baru</button>
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap">{isUploading ? '...' : <Upload size={20}/>} CSV</button>
                </div>
            )}
        </div>
      </div>

      {/* --- TAMPILAN MOBILE (KARTU) --- */}
      {/* Hidden di MD ke atas, Block di layar kecil */}
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

      {/* --- TAMPILAN DESKTOP (TABEL) --- */}
      {/* Hidden di layar kecil, Block di MD ke atas */}
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
            {filtered.map((product) => (
                <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="p-4">
                    <div className="font-bold dark:text-white">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.barcode || '-'}</div>
                  </td>
                  <td className="p-4 dark:text-gray-300">Rp {product.price.toLocaleString()}</td>
                  <td className={`p-4 text-center font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>{product.stock}</td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingProduct(product)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"><Edit size={18}/></button>
                            <button onClick={() => deleteProduct(product.id)} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={18}/></button>
                        </div>
                    </td>
                  )}
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL EDIT (SAMA) */}
      {editingProduct && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white">Edit Produk</h3>
                    <button onClick={() => setEditingProduct(null)}><X size={24} className="text-gray-400"/></button>
                </div>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-500">Nama</label>
                        <input className="w-full border p-2 rounded-lg dark:bg-slate-700 dark:text-white" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm text-gray-500">Harga</label><input type="number" className="w-full border p-2 rounded-lg dark:bg-slate-700 dark:text-white" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})} required /></div>
                        <div><label className="text-sm text-gray-500">Stok</label><input type="number" className="w-full border p-2 rounded-lg dark:bg-slate-700 dark:text-white" value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} required /></div>
                    </div>
                    <div><label className="text-sm text-gray-500">Barcode</label><input className="w-full border p-2 rounded-lg dark:bg-slate-700 dark:text-white" value={editingProduct.barcode || ''} onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})} /></div>
                    <button type="submit" className="w-full py-3 bg-pop-green text-white rounded-xl font-bold flex justify-center gap-2"><Save size={18}/> Simpan</button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}