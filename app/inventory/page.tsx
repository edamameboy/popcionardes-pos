'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { Plus, Search, Trash2, Upload, Download, Edit, X, Save, Barcode, ArrowUpDown, ArrowUp, ArrowDown, Scale, ClipboardCheck, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCsv } from '@/utils/exportToCsv'

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isGudang, setIsGudang] = useState(false)
  const [isKasir, setIsKasir] = useState(false) // <--- State Kasir
  const [userName, setUserName] = useState('Staff')

  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [opnameModal, setOpnameModal] = useState(false)
  const [opnameData, setOpnameData] = useState<any>(null)
  const [isSavingOpname, setIsSavingOpname] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

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
    setUserName(user.user_metadata?.full_name || 'Staff')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    
    // --- VALIDASI ROLE ---
    if (profile?.role === 'admin') setIsAdmin(true)
    else if (profile?.role === 'gudang') setIsGudang(true)
    else if (profile?.role === 'kasir') setIsKasir(true)
    else return router.push('/login')
    // ---------------------
    
    fetchProducts()
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    if (data) setProducts(data)
    setLoading(false)
  }

  const deleteProduct = async (id: number) => {
    if (!isAdmin) return toast.error("Akses Ditolak: Hanya Admin.")
    if (confirm('Hapus produk ini?')) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) {
        if (error.message.includes('foreign key')) toast.error("GAGAL: Produk sudah ada di riwayat transaksi.")
        else toast.error('Gagal: ' + error.message)
      } else fetchProducts()
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    const { error } = await supabase.from('products').update({ name: editingProduct.name, price: editingProduct.price, barcode: editingProduct.barcode, description: editingProduct.description }).eq('id', editingProduct.id)
    if (error) toast.error("Gagal update: " + error.message)
    else { toast.success("Data berhasil diperbarui!"); setEditingProduct(null); fetchProducts() }
  }

  const handleOpenOpname = (product: any) => {
      setOpnameData({ id: product.id, name: product.name, old_stock: product.stock, new_stock: product.stock, reason: '' })
      setOpnameModal(true)
  }

  const submitOpname = async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSavingOpname(true)
      const difference = opnameData.new_stock - opnameData.old_stock
      const { error: updateError } = await supabase.from('products').update({ stock: opnameData.new_stock }).eq('id', opnameData.id)
      if (updateError) { toast.error("Gagal merubah stok: " + updateError.message); setIsSavingOpname(false); return }

      await supabase.from('stock_adjustments').insert({ product_id: opnameData.id, product_name: opnameData.name, old_stock: opnameData.old_stock, new_stock: opnameData.new_stock, difference: difference, reason: opnameData.reason || 'Penyesuaian Manual', user_name: userName })
      setOpnameModal(false); setIsSavingOpname(false); fetchProducts(); toast.success("Stok berhasil di-opname!")
  }

  const handleExport = () => {
    // Membuat 1 baris data contoh (dummy) agar user tahu cara mengisinya
    const templateData = [
      {
        ID: '', // Sengaja dikosongkan. Jika kosong = Tambah Barang Baru
        Barcode: '899123456789',
        Nama_Produk: 'Contoh Produk Kopi Susu',
        SKU: 'KPS-200ML',
        Harga_Jual: 15000,
        Stok_Saat_Ini: 100
      }
    ]

    // Ingat urutannya: (namaFile, data)
    exportToCsv('Template_Mass_Upload_Produk', templateData)
    
    toast.success("Template CSV berhasil diunduh!")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const loadToast = toast.loading('Memproses file CSV...')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
          const productsToUpsert = rows.map((row: any) => {
            // Membaca nama kolom sesuai dengan format Export kita
            const idStr = row['ID']
            const id = idStr && idStr.trim() !== '' ? parseInt(idStr) : undefined
            
            const name = row['Nama_Produk'] || row['Nama']
            // Bersihkan angka dari format uang (jika ada Rp atau koma)
            const price = parseInt(String(row['Harga_Jual'] || 0).replace(/[^0-9]/g, '')) || 0
            const stock = parseInt(String(row['Stok_Saat_Ini'] || row['Stok'] || 0).replace(/[^0-9-]/g, '')) || 0
            
            const barcode = row['Barcode'] && row['Barcode'] !== '-' ? row['Barcode'].toString().trim() : null
            const sku = row['SKU'] && row['SKU'] !== '-' ? row['SKU'].toString().trim() : null

            // Lewati jika nama produk kosong
            if (!name || name.trim() === '') return null 

            const productData: any = {
              name: name.trim(),
              price: price,
              stock: stock,
              barcode: barcode,
              sku: sku
            }

            // Jika ada ID (barang lama), sertakan ID agar Supabase melakukan Update
            if (id && !isNaN(id)) {
              productData.id = id
            }

            return productData
          }).filter(Boolean) // Buang data yang null (kosong)

          if (productsToUpsert.length === 0) {
             throw new Error("File kosong atau format nama kolom tidak sesuai.")
          }

          // Lakukan operasi INSERT (baru) atau UPDATE (lama) sekaligus
          const { error } = await supabase.from('products').upsert(productsToUpsert)
          
          if (error) throw error

          toast.success(`${productsToUpsert.length} data master berhasil disinkronkan!`, { id: loadToast })
          fetchProducts() // Refresh tabel inventory

        } catch (error: any) {
          toast.error(`Gagal import: ${error.message}`, { id: loadToast })
        } finally {
          setIsUploading(false)
          // Reset input file agar bisa pilih file yang sama lagi
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      },
      error: (error) => {
        toast.error(`Gagal membaca file: ${error.message}`, { id: loadToast })
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  const handleExportOpnameCSV = () => {
    if (products.length === 0) return toast.error("Belum ada data untuk diexport.")
    
    // Perbaikan: Mengganti ID dengan Barcode di urutan pertama
    const csvData = products.map(p => ({ 
        'Barcode': p.barcode || '-', 
        'SKU': p.sku || '-',
        'Nama Produk': p.name || '-', 
        'Stok Sistem (Jangan Diubah)': p.stock || 0, 
        'Stok Fisik (Isi Disini)': '', 
        'Alasan (Opsional)': '' 
    }))
    
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); 
    
    link.href = URL.createObjectURL(blob); 
    link.download = `Kertas_Kerja_Opname_${new Date().toISOString().split('T')[0]}.csv`; 
    link.style.visibility = 'hidden'; 
    
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link)
    
    toast.success("Kertas Kerja berhasil diunduh!")
  }
  
  const handleOpnameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return; 
    setIsUploading(true)

    Papa.parse(file, {
      header: true, 
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data; 
        const adjustments: any[] = []; 
        const productUpdates: any[] = []

        rows.forEach((row: any) => {
            // PERBAIKAN 1: Baca Barcode & Nama Produk, bukan ID lagi
            const barcode = row['Barcode'] 
            const namaProduk = row['Nama Produk']
            const fisikStr = row['Stok Fisik (Isi Disini)']

            // Jika fisik kosong/tidak diisi, langsung lewati baris ini
            if (fisikStr === undefined || fisikStr === '') return

            const fisik = parseInt(String(fisikStr).replace(/[^0-9-]/g, '')); 
            if (isNaN(fisik)) return

            // PERBAIKAN 2: Cari produk di database berdasarkan Barcode (atau Nama jika tidak ada barcode)
            const existing = products.find(p => 
                (barcode && barcode !== '-' && p.barcode === String(barcode).trim()) || 
                (p.name === namaProduk)
            ); 
            
            if (!existing) return

            // Jika stok fisiknya beda dengan sistem, masukkan ke daftar update
            if (existing.stock !== fisik) {
                adjustments.push({ 
                    product_id: existing.id, 
                    product_name: existing.name, 
                    old_stock: existing.stock, 
                    new_stock: fisik, 
                    difference: fisik - existing.stock, 
                    reason: row['Alasan (Opsional)'] || 'Mass Opname via CSV', 
                    user_name: userName // Pastikan variabel userName sudah ada di file Anda
                })
                productUpdates.push({ ...existing, stock: fisik })
            }
        })

        if (productUpdates.length === 0) { 
            toast.error('Tidak ada selisih stok / tidak ada yang diisi. Opname dibatalkan.'); 
            setIsUploading(false); 
            if (opnameInputRef.current) opnameInputRef.current.value = ''; 
            return 
        }

        // Simpan perubahan stok ke tabel products
        const { error: prodErr } = await supabase.from('products').upsert(productUpdates); 
        if (prodErr) { 
            toast.error('Gagal update stok: ' + prodErr.message); 
            setIsUploading(false); 
            return 
        }

        // Catat riwayat perubahan ke tabel stock_adjustments
        await supabase.from('stock_adjustments').insert(adjustments)

        toast.success(`Berhasil! ${productUpdates.length} produk mengalami penyesuaian stok.`); 
        fetchProducts(); 
        setIsUploading(false); 
        if (opnameInputRef.current) opnameInputRef.current.value = '' 
        
      }, 
      error: (error) => { 
          toast.error('Error membaca file: ' + error.message); 
          setIsUploading(false) 
      }
    })
  }

  const requestSort = (key: string) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }) }
  const getSortIcon = (key: string) => { if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 opacity-50" />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" /> }

  const processedData = useMemo(() => {
    let filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)))
    if (sortConfig !== null) { filtered.sort((a, b) => { if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1; if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1; return 0 }) }
    return filtered
  }, [products, search, sortConfig])

  return (
    <div className="p-4 pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors select-none">
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
            <div className="flex gap-2 w-full xl:w-auto flex-1">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input type="text" placeholder="Cari Produk..." className="w-full pl-10 p-2.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-pop-green" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 outline-none focus:ring-2 focus:ring-pop-green w-32 md:w-40" onChange={(e) => { const val = e.target.value; if (!val) setSortConfig(null); else { const [key, dir] = val.split('-'); setSortConfig({ key, direction: dir as 'asc'|'desc' }) } }}>
                    <option value="">Urutkan...</option><option value="name-asc">A - Z</option><option value="name-desc">Z - A</option><option value="price-desc">Harga Tertinggi</option><option value="price-asc">Harga Terendah</option><option value="stock-asc">Stok Menipis</option><option value="stock-desc">Stok Terbanyak</option>
                </select>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 w-full xl:w-auto">
                {isAdmin && (
                    <div className="flex overflow-x-auto no-scrollbar rounded-xl shadow-sm border border-blue-200 dark:border-blue-900/30 w-full lg:w-auto">
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center whitespace-nowrap shrink-0">DATA MASTER</div>
                        <button onClick={handleExport} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-blue-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors"><Download size={16}/> Template</button>
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-blue-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors">{isUploading ? '⏳' : <><Upload size={16}/> Import</>}</button>
                    </div>
                )}
                {(isAdmin || isGudang) && (
                    <div className="flex overflow-x-auto no-scrollbar rounded-xl shadow-sm border border-purple-200 dark:border-purple-900/30 w-full lg:w-auto">
                        <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center whitespace-nowrap shrink-0">OPNAME</div>
                        <button onClick={handleExportOpnameCSV} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-purple-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors"><ClipboardCheck size={16}/> Format</button>
                        <input type="file" accept=".csv" ref={opnameInputRef} onChange={handleOpnameUpload} className="hidden" />
                        <button onClick={() => opnameInputRef.current?.click()} disabled={isUploading} className="shrink-0 bg-white dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2 text-sm border-l border-purple-100 dark:border-slate-700 flex items-center gap-1 font-medium transition-colors">{isUploading ? '⏳' : <><Scale size={16}/> Upload Hasil</>}</button>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* TAMPILAN MOBILE */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading ? <div className="text-center py-10 text-gray-500">Memuat...</div> : 
         processedData.length === 0 ? <div className="text-center py-10 text-gray-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">Produk Kosong</div> :
         processedData.map((product) => (
            <div key={product.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="font-bold text-lg dark:text-white">{product.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Barcode size={12}/> {product.barcode || '-'} {product.description && <span className="text-blue-500 ml-2">{product.description}</span>}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${product.stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>Stok: {product.stock}</div>
                </div>
                <div className="flex justify-between items-center border-t dark:border-slate-700 pt-3 mt-2">
                    <div className="font-bold text-gray-700 dark:text-gray-200">Rp {product.price.toLocaleString()}</div>
                    <div className="flex gap-2">
                        {(isAdmin || isGudang) && (
                            <button onClick={() => handleOpenOpname(product)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 shadow-sm"><Scale size={18}/></button>
                        )}
                        {(isAdmin || isKasir) && (
                            <button onClick={() => setEditingProduct(product)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 shadow-sm"><Edit size={18}/></button>
                        )}
                        {isAdmin && (
                            <button onClick={() => deleteProduct(product.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 shadow-sm"><Trash2 size={18}/></button>
                        )}
                    </div>
                </div>
            </div>
         ))
        }
      </div>

      {/* TAMPILAN DESKTOP/TABLET */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-b dark:border-slate-700">
            <tr>
              <th className="p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('name')}><div className="flex items-center gap-2">Produk {getSortIcon('name')}</div></th>
              <th className="p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('price')}><div className="flex items-center gap-2">Harga {getSortIcon('price')}</div></th>
              <th className="p-4 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('stock')}><div className="flex items-center justify-center gap-2">Stok {getSortIcon('stock')}</div></th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-500">Memuat...</td></tr> : 
             processedData.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-500">Produk tidak ditemukan</td></tr> : 
             processedData.map((product) => (
                <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="p-4"><div className="font-bold dark:text-white">{product.name}</div><div className="text-xs text-gray-500">{product.barcode || '-'}</div></td>
                  <td className="p-4 dark:text-gray-300 font-medium">Rp {product.price.toLocaleString()}</td>
                  <td className={`p-4 text-center font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>{product.stock}</td>
                  <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {(isAdmin || isGudang) && (
                            <button onClick={() => handleOpenOpname(product)} className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg dark:bg-purple-900/20 dark:text-purple-400" title="Opname Stok"><Scale size={18} /></button>
                        )}
                        {(isAdmin || isKasir) && (
                            <button onClick={() => setEditingProduct(product)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400" title="Edit Data"><Edit size={18} /></button>
                        )}
                        {isAdmin && (
                            <button onClick={() => deleteProduct(product.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400" title="Hapus Produk"><Trash2 size={18} /></button>
                        )}
                      </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL EDIT DATA MASTER (KHUSUS KASIR DISABLED NAMA & BARCODE) --- */}
      {editingProduct && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white">Edit Master Produk</h3>
                    <button onClick={() => setEditingProduct(null)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                {isKasir && !isAdmin && (
                    <div className="mb-4 text-[10px] text-orange-600 bg-orange-50 p-2 rounded border border-orange-200 leading-tight">
                        *Sebagai Kasir, Anda hanya diizinkan mengubah <b>Harga Produk</b>.
                    </div>
                )}
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nama Produk</label>
                        <input className={`w-full border p-3 rounded-xl dark:border-slate-600 font-bold outline-none focus:ring-2 focus:ring-pop-green ${!isAdmin ? 'bg-gray-100 text-gray-500 dark:bg-slate-700/50 cursor-not-allowed' : 'bg-gray-50 dark:bg-slate-700 dark:text-white'}`} value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required disabled={!isAdmin} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Harga (Rp)</label>
                        <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-pop-green" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Barcode</label>
                            <input className={`w-full border p-3 rounded-xl text-sm dark:border-slate-600 outline-none focus:ring-2 focus:ring-pop-green ${!isAdmin ? 'bg-gray-100 text-gray-500 dark:bg-slate-700/50 cursor-not-allowed' : 'bg-gray-50 dark:bg-slate-700 dark:text-white'}`} value={editingProduct.barcode || ''} onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})} disabled={!isAdmin} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Deskripsi / SKU</label>
                            <input className={`w-full border p-3 rounded-xl text-sm dark:border-slate-600 outline-none focus:ring-2 focus:ring-pop-green ${!isAdmin ? 'bg-gray-100 text-gray-500 dark:bg-slate-700/50 cursor-not-allowed' : 'bg-gray-50 dark:bg-slate-700 dark:text-white'}`} value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} disabled={!isAdmin} />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-pop-green hover:bg-pop-green-dark text-white rounded-xl font-bold flex justify-center gap-2 mt-4 transition-colors"><Save size={18}/> Simpan Perubahan</button>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL STOCK OPNAME SATUAN (GUDANG / ADMIN) --- */}
      {opnameModal && opnameData && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
           {/* ... kode modal opname sama ... */}
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold dark:text-white flex items-center gap-2"><Scale className="text-purple-500"/> Stock Opname</h3>
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
                            <input type="number" className="w-full text-center border p-3 rounded-xl bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold text-2xl outline-none focus:ring-2 focus:ring-purple-500 shadow-inner" value={opnameData.new_stock} onChange={e => setOpnameData({...opnameData, new_stock: parseInt(e.target.value) || 0})} required />
                            <button type="button" onClick={() => setOpnameData({...opnameData, new_stock: opnameData.new_stock + 1})} className="p-3 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 text-gray-600 dark:text-white transition-colors"><Plus size={20}/></button>
                        </div>
                        <div className={`text-xs mt-2 font-bold text-center bg-gray-50 dark:bg-slate-900 py-1 rounded border dark:border-slate-700 ${opnameData.new_stock < opnameData.old_stock ? 'text-red-500' : opnameData.new_stock > opnameData.old_stock ? 'text-green-500' : 'text-gray-400'}`}>Selisih Stok: {opnameData.new_stock - opnameData.old_stock > 0 ? '+' : ''}{opnameData.new_stock - opnameData.old_stock} Item</div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Catatan / Alasan</label>
                        <input list="opname-reasons" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm outline-none focus:ring-2 focus:ring-purple-500 mt-1" placeholder="Tulis alasan..." value={opnameData.reason} onChange={e => setOpnameData({...opnameData, reason: e.target.value})} required />
                        <datalist id="opname-reasons"><option value="Barang Hilang" /><option value="Barang Rusak / Cacat" /><option value="Kesalahan Hitung Sebelumnya" /><option value="Barang Masuk / Restock" /></datalist>
                    </div>
                    <button type="submit" disabled={isSavingOpname || opnameData.new_stock === opnameData.old_stock} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex justify-center gap-2 mt-4 transition-colors disabled:bg-gray-400 shadow-md shadow-purple-500/20">{isSavingOpname ? 'Menyimpan...' : 'Simpan Laporan Opname'}</button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}