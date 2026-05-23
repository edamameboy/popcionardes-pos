'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { Plus, Search, Trash2, Upload, Download, Edit, X, Save, Barcode, ArrowUpDown, ArrowUp, ArrowDown, Scale, ClipboardCheck, Minus } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('Kasir')

  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  
  // State Modal Opname Satuan
  const [opnameModal, setOpnameModal] = useState(false)
  const [opnameData, setOpnameData] = useState<any>(null)
  const [isSavingOpname, setIsSavingOpname] = useState(false)

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

  // 2 File Inputs Berbeda (Satu untuk Master Data, Satu untuk Opname)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const opnameInputRef = useRef<HTMLInputElement>(null)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUserAndFetch()
  }, [])

  const checkUserAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    setUserName(user.user_metadata?.full_name || 'Admin')

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

  // --- 1. SIMPAN EDIT MASTER (SATUAN) ---
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    const { error } = await supabase.from('products').update({
        name: editingProduct.name, price: editingProduct.price,
        barcode: editingProduct.barcode, description: editingProduct.description
        // STOK TIDAK DIUBAH DI SINI AGAR WAJIB VIA OPNAME
    }).eq('id', editingProduct.id)
    
    if (error) alert("Gagal update: " + error.message)
    else { alert("Sukses!"); setEditingProduct(null); fetchProducts() }
  }

  // --- 2. OPNAME SATUAN (POPUP) ---
  const handleOpenOpname = (product: any) => {
      setOpnameData({
          id: product.id, name: product.name, old_stock: product.stock, new_stock: product.stock, reason: ''
      })
      setOpnameModal(true)
  }

  const submitOpname = async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSavingOpname(true)
      const difference = opnameData.new_stock - opnameData.old_stock
      
      const { error: updateError } = await supabase.from('products').update({ stock: opnameData.new_stock }).eq('id', opnameData.id)
      if (updateError) { alert("Gagal merubah stok: " + updateError.message); setIsSavingOpname(false); return }

      await supabase.from('stock_adjustments').insert({
          product_id: opnameData.id, product_name: opnameData.name, old_stock: opnameData.old_stock,
          new_stock: opnameData.new_stock, difference: difference, reason: opnameData.reason || 'Penyesuaian Manual', user_name: userName
      })

      setOpnameModal(false); setIsSavingOpname(false); fetchProducts(); alert("Stok berhasil di-opname!")
  }

  // =======================================================
  // FITUR MASS UPDATE (DATA MASTER) - TIDAK MERUBAH STOK LAMA
  // =======================================================
  const handleExportCSV = () => {
    if (products.length === 0) return alert("Belum ada data untuk diexport.")
    const csvData = products.map(p => ({
        'id': p.id, 'barcode': p.barcode || '', 'sku': p.description ? p.description.replace('SKU: ', '') : '',
        'nama produk': p.name, 'harga': p.price, 'stok_awal': p.stock 
        // Stok diexport sbg info saja, import balik tidak akan mengubah stok produk lama
    }))
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Master_Data_Produk_${new Date().toISOString().split('T')[0]}.csv`
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsUploading(true)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        const formattedData = rows.map((row: any) => {
          const rawId = row['id']; const rawNama = row['nama produk'] || row['name']
          const rawHarga = row['harga'] || row['price']; const rawQty = row['stok_awal'] || row['qty'] || row['stock']
          const cleanNumber = (val: any) => parseInt(String(val).replace(/[^0-9]/g, '')) || 0
          const harga = cleanNumber(rawHarga); const qty = cleanNumber(rawQty)
          if (!rawNama || harga <= 0) return null

          // Jika barang sudah ada (punya ID), kita KUNCI stoknya dengan stok lama
          if (rawId) {
              const existing = products.find(p => p.id === parseInt(rawId))
              if (existing) {
                  return { ...existing, name: rawNama, price: harga, barcode: row['barcode'] ? String(row['barcode']) : null, description: row['sku'] ? `SKU: ${row['sku']}` : '' }
              }
          }
          // Jika barang BARU, baru kita masukkan stoknya sesuai kolom
          return { name: rawNama, price: harga, stock: qty, barcode: row['barcode'] ? String(row['barcode']) : null, description: row['sku'] ? `SKU: ${row['sku']}` : '' }
        }).filter(item => item !== null) 

        if (formattedData.length === 0) { alert('Gagal! Tidak ada data valid.'); setIsUploading(false); return }
        const { error } = await supabase.from('products').upsert(formattedData)
        if (error) alert('Gagal Upload: ' + error.message)
        else { alert(`Sukses import master data! Perubahan harga/nama berhasil diterapkan.`); fetchProducts() }
        setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' 
      },
      error: (error) => { alert('Error membaca file: ' + error.message); setIsUploading(false) }
    })
  }

  // =======================================================
  // FITUR MASS OPNAME (AUDIT TRAIL CSV) - FOKUS HANYA STOK
  // =======================================================
  const handleExportOpnameCSV = () => {
    if (products.length === 0) return alert("Belum ada data untuk diexport.")
    const csvData = products.map(p => ({
        'ID': p.id,
        'Nama Produk': p.name,
        'Stok Sistem (Jangan Diubah)': p.stock,
        'Stok Fisik (Isi Disini)': '',
        'Alasan (Opsional)': ''
    }))
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Kertas_Kerja_Opname_${new Date().toISOString().split('T')[0]}.csv`
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const handleOpnameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsUploading(true)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        const adjustments: any[] = []
        const productUpdates: any[] = []

        rows.forEach((row: any) => {
            const id = parseInt(row['ID'])
            const fisikStr = row['Stok Fisik (Isi Disini)']
            
            // Abaikan jika tidak ada ID atau kolom stok fisik dibiarkan kosong oleh staf
            if (!id || fisikStr === undefined || fisikStr === '') return
            
            const fisik = parseInt(String(fisikStr).replace(/[^0-9-]/g, ''))
            if (isNaN(fisik)) return

            const existing = products.find(p => p.id === id)
            if (!existing) return

            // Jika stok fisiknya BEDA dengan stok sistem, catat laporannya!
            if (existing.stock !== fisik) {
                adjustments.push({
                    product_id: existing.id,
                    product_name: existing.name,
                    old_stock: existing.stock,
                    new_stock: fisik,
                    difference: fisik - existing.stock,
                    reason: row['Alasan (Opsional)'] || 'Mass Opname via CSV',
                    user_name: userName
                })
                productUpdates.push({ ...existing, stock: fisik })
            }
        })

        if (productUpdates.length === 0) {
            alert('Tidak ada selisih stok / format kosong. Opname selesai tanpa perubahan.')
            setIsUploading(false); if (opnameInputRef.current) opnameInputRef.current.value = ''; return
        }

        // 1. Eksekusi Perubahan Stok Utama
        const { error: prodErr } = await supabase.from('products').upsert(productUpdates)
        if (prodErr) { alert('Gagal update stok: ' + prodErr.message); setIsUploading(false); return }

        // 2. Eksekusi Catatan Audit Log
        const { error: audErr } = await supabase.from('stock_adjustments').insert(adjustments)
        if (audErr) console.error("Error catat log:", audErr)

        alert(`Berhasil! ${productUpdates.length} produk mengalami penyesuaian stok dan telah tercatat di Riwayat Opname.`)
        fetchProducts()
        setIsUploading(false)
        if (opnameInputRef.current) opnameInputRef.current.value = '' 
      },
      error: (error) => { alert('Error membaca file: ' + error.message); setIsUploading(false) }
    })
  }

  // --- LOGIKA FILTER & SORTING ---
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 opacity-50" />
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
  }

  const processedData = useMemo(() => {
    let filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)))
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
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory</h1>
            {isAdmin && (
                 <button onClick={() => router.push('/inventory/add')} className="bg-pop-green hover:bg-pop-green-dark text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm">
                    <Plus size={20} /> <span className="hidden md:inline">Tambah Baru</span>
                 </button>
            )}
        </div>
        
        <div className="flex flex-col xl:flex-row gap-3">
            {/* Input Cari & Sort */}
            <div className="flex gap-2 w-full xl:w-auto flex-1">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input type="text" placeholder="Cari Produk..." className="w-full pl-10 p-2.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-pop-green" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 outline-none focus:ring-2 focus:ring-pop-green w-32 md:w-40" onChange={(e) => { const val = e.target.value; if (!val) setSortConfig(null); else { const [key, dir] = val.split('-'); setSortConfig({ key, direction: dir as 'asc'|'desc' }) } }}>
                    <option value="">Urutkan...</option><option value="name-asc">A - Z</option><option value="name-desc">Z - A</option><option value="price-desc">Harga Tertinggi</option><option value="price-asc">Harga Terendah</option><option value="stock-asc">Stok Menipis</option><option value="stock-desc">Stok Terbanyak</option>
                </select>
            </div>

            {/* ACTION GROUPS (HANYA ADMIN) */}
            {isAdmin && (
                <div className="flex flex-col lg:flex-row gap-3 w-full xl:w-auto">
                    
                    {/* GROUP DATA MASTER */}
                    <div className="flex overflow-x-auto no-scrollbar rounded-xl shadow-sm border border-blue-200 dark:border-blue-900/30 w-full lg:w-auto">
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center whitespace-nowrap shrink-0">DATA MASTER</div>
                        <button onClick={handleExportCSV} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-blue-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors">
                            <Download size={16}/> Export
                        </button>
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-blue-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors">
                            {isUploading ? '⏳' : <><Upload size={16}/> Import</>}
                        </button>
                    </div>

                    {/* GROUP OPNAME */}
                    <div className="flex overflow-x-auto no-scrollbar rounded-xl shadow-sm border border-purple-200 dark:border-purple-900/30 w-full lg:w-auto">
                        <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center whitespace-nowrap shrink-0">OPNAME</div>
                        <button onClick={handleExportOpnameCSV} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-purple-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors">
                            <ClipboardCheck size={16}/> Format
                        </button>
                        <input type="file" accept=".csv" ref={opnameInputRef} onChange={handleOpnameUpload} className="hidden" />
                        <button onClick={() => opnameInputRef.current?.click()} disabled={isUploading} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-purple-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors">
                            {isUploading ? '⏳' : <><Scale size={16}/> Upload Hasil</>}
                        </button>
                    </div>
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
                            <button onClick={() => handleOpenOpname(product)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 shadow-sm"><Scale size={18}/></button>
                            <button onClick={() => setEditingProduct(product)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 shadow-sm"><Edit size={18}/></button>
                            <button onClick={() => deleteProduct(product.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 shadow-sm"><Trash2 size={18}/></button>
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
                        <button onClick={() => handleOpenOpname(product)} className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg dark:bg-purple-900/20 dark:text-purple-400" title="Opname Stok">
                            <Scale size={18} />
                        </button>
                        <button onClick={() => setEditingProduct(product)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400" title="Edit Data">
                            <Edit size={18} />
                        </button>
                        <button onClick={() => deleteProduct(product.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400" title="Hapus Produk">
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

      {/* MODAL EDIT DATA MASTER */}
      {editingProduct && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white">Edit Master Produk</h3>
                    <button onClick={() => setEditingProduct(null)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                <div className="mb-4 text-[10px] text-blue-600 bg-blue-50 p-2 rounded border border-blue-200 leading-tight">
                    *Edit di sini <b>TIDAK merubah jumlah stok</b>. Untuk menyesuaikan fisik barang, gunakan tombol <b>Opname</b> (Timbangan) di luar.
                </div>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nama Produk</label>
                        <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Harga (Rp)</label>
                        <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})} required />
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

      {/* --- MODAL STOCK OPNAME SATUAN --- */}
      {opnameModal && opnameData && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                        <Scale className="text-purple-500"/> Stock Opname
                    </h3>
                    <button onClick={() => setOpnameModal(false)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                
                <div className="mb-4 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border dark:border-slate-700 shadow-inner">
                    <div className="font-bold dark:text-white">{opnameData.name}</div>
                    <div className="text-xs text-gray-500 mt-1">Sistem: <span className="font-bold text-lg text-gray-800 dark:text-gray-200 ml-1">{opnameData.old_stock}</span></div>
                </div>

                <form onSubmit={submitOpname} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Stok Fisik (Asli Gudang)</label>
                        <div className="flex items-center gap-3 mt-1">
                            <button type="button" onClick={() => setOpnameData({...opnameData, new_stock: Math.max(0, opnameData.new_stock - 1)})} className="p-3 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 text-gray-600 dark:text-white transition-colors"><Minus size={20}/></button>
                            <input 
                                type="number" 
                                className="w-full text-center border p-3 rounded-xl bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold text-2xl outline-none focus:ring-2 focus:ring-purple-500 shadow-inner" 
                                value={opnameData.new_stock} 
                                onChange={e => setOpnameData({...opnameData, new_stock: parseInt(e.target.value) || 0})} 
                                required 
                            />
                            <button type="button" onClick={() => setOpnameData({...opnameData, new_stock: opnameData.new_stock + 1})} className="p-3 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 text-gray-600 dark:text-white transition-colors"><Plus size={20}/></button>
                        </div>
                        
                        <div className={`text-xs mt-2 font-bold text-center bg-gray-50 dark:bg-slate-900 py-1 rounded border dark:border-slate-700 ${opnameData.new_stock < opnameData.old_stock ? 'text-red-500' : opnameData.new_stock > opnameData.old_stock ? 'text-green-500' : 'text-gray-400'}`}>
                            Selisih Stok: {opnameData.new_stock - opnameData.old_stock > 0 ? '+' : ''}{opnameData.new_stock - opnameData.old_stock} Item
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Catatan / Alasan</label>
                        <input 
                            list="opname-reasons"
                            className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm outline-none focus:ring-2 focus:ring-purple-500 mt-1" 
                            placeholder="Tulis alasan..."
                            value={opnameData.reason} 
                            onChange={e => setOpnameData({...opnameData, reason: e.target.value})} 
                            required
                        />
                        <datalist id="opname-reasons">
                            <option value="Barang Hilang" />
                            <option value="Barang Rusak / Cacat" />
                            <option value="Kesalahan Hitung Sebelumnya" />
                            <option value="Barang Masuk / Restock" />
                        </datalist>
                    </div>

                    <button type="submit" disabled={isSavingOpname || opnameData.new_stock === opnameData.old_stock} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex justify-center gap-2 mt-4 transition-colors disabled:bg-gray-400 shadow-md shadow-purple-500/20">
                        {isSavingOpname ? 'Menyimpan...' : 'Simpan Laporan Opname'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}