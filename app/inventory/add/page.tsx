'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Package, Barcode as BarcodeIcon, Tag, DollarSign, Layers, Camera, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Scanner from '@/components/Scanner' 

export default function AddProduct() {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    sku: '',
    barcode: ''
  })
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showScanner, setShowScanner] = useState(false) 
  
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkRole()
    if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
    }
  }, [])

  // ==========================================
  // FITUR BARU: AUTOFILL SKU UNTUK FUNKO
  // ==========================================
  useEffect(() => {
    const namaProduk = formData.name.toLowerCase()
    const barcode = formData.barcode.trim()

    // Cek apakah nama ada kata "funko" dan barcode panjangnya wajar (minimal 11/12 angka)
    if (namaProduk.includes('funko') && barcode.length >= 11) {
        
        // Logika Ekstraksi: Ambil 5 angka tepat sebelum digit terakhir (Check Digit)
        // Contoh: 889698[52427]8 (12 digit) -> memotong dari index belakang
        const extractedDigits = barcode.substring(barcode.length - 6, barcode.length - 1)
        const otomatisSku = `FUN${extractedDigits}`
        
        // Update state SKU jika nilainya berbeda (untuk mencegah infinite loop)
        if (formData.sku !== otomatisSku) {
            setFormData(prev => ({ ...prev, sku: otomatisSku }))
            toast.success(`SKU Otomatis Dibuat: ${otomatisSku}`, { icon: '✨', id: 'sku-toast' })
        }
    }
  }, [formData.name, formData.barcode]) // Akan berjalan setiap kali Nama atau Barcode berubah
  // ==========================================

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
        toast.error("Akses Ditolak: Hanya Admin yang bisa menambah master data.")
        router.push('/inventory')
    } else {
        setIsAdmin(true)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleScanSuccess = (result: string) => {
    setFormData(prev => ({ ...prev, barcode: result }))
    setShowScanner(false) 
    toast.success("Barcode terdeteksi!")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const loadToast = toast.loading('Menyimpan produk...')

    if (!formData.name || !formData.price) {
        toast.error("Nama dan Harga Jual wajib diisi!", { id: loadToast })
        setLoading(false)
        return
    }

    try {
      const { error } = await supabase.from('products').insert([
        { 
          name: formData.name.trim(),
          sku: formData.sku.trim() || null,
          barcode: formData.barcode.trim() || null,
          price: parseInt(formData.price) || 0,
          stock: parseInt(formData.stock) || 0
        }
      ])

      if (error) throw error

      toast.success("Produk baru berhasil ditambahkan!", { id: loadToast })
      router.push('/inventory')
    } catch (error: any) {
      toast.error(`Gagal menyimpan: ${error.message}`, { id: loadToast })
      setLoading(false)
    }
  }

  if (!isAdmin) return null 

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 transition-colors duration-300">
      
      {showScanner && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="flex justify-between items-center p-4 bg-gray-900 text-white shadow-md">
                <h3 className="font-bold flex items-center gap-2"><Camera size={18}/> Scan Barcode Produk</h3>
                <button onClick={() => setShowScanner(false)} className="p-2 bg-gray-800 hover:bg-red-500 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 relative bg-black">
                <Scanner onScan={handleScanSuccess} onClose={() => setShowScanner(false)} />
                <div className="absolute bottom-10 left-0 right-0 text-center text-white text-sm animate-pulse drop-shadow-md">
                    Arahkan garis kamera ke barcode...
                </div>
            </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-20 shadow-sm border-b dark:border-slate-700 flex items-center gap-3">
        <button 
            onClick={() => router.push('/inventory')} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
        >
            <ArrowLeft size={24} />
        </button>
        <div>
            <h1 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                <Package size={20} className="text-pop-green"/> Tambah Produk
            </h1>
            <p className="text-[10px] text-gray-500">Masukkan data master barang baru</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto mt-4">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            
            <div className="p-5 space-y-5">
                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><BarcodeIcon size={14}/> Barcode</label>
                    <div className="flex gap-2">
                        <input 
                            ref={barcodeInputRef}
                            type="text" 
                            name="barcode"
                            value={formData.barcode}
                            onChange={handleChange}
                            placeholder="Ketik atau pakai alat scanner..." 
                            className="flex-1 w-full border dark:border-slate-600 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pop-green transition-all"
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowScanner(true)}
                            className="px-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center border border-blue-100 dark:border-blue-800"
                        >
                            <Camera size={24}/>
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><Package size={14}/> Nama Produk <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Cth: Funko Pop Spiderman" 
                        className="w-full border dark:border-slate-600 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-pop-green transition-all"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><Tag size={14}/> SKU (Kode Internal)</label>
                    <input 
                        type="text" 
                        name="sku"
                        value={formData.sku}
                        onChange={handleChange}
                        placeholder="Cth: KPS-ARN-01" 
                        className="w-full border dark:border-slate-600 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pop-green transition-all"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><DollarSign size={14}/> Harga Jual <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                            <input 
                                type="number" 
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                required
                                placeholder="0" 
                                className="w-full border dark:border-slate-600 p-3.5 pl-9 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-pop-green transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><Layers size={14}/> Stok Awal</label>
                        <input 
                            type="number" 
                            name="stock"
                            value={formData.stock}
                            onChange={handleChange}
                            placeholder="0" 
                            className="w-full border dark:border-slate-600 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-pop-green transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex gap-3">
                <button 
                    type="button"
                    onClick={() => router.push('/inventory')}
                    className="flex-1 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                    Batal
                </button>
                <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-3.5 rounded-xl font-bold text-white bg-pop-green hover:bg-emerald-600 disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-md shadow-green-200 dark:shadow-none transition-all active:scale-[0.98]"
                >
                    {loading ? 'Menyimpan...' : <><Save size={20}/> Simpan Produk</>}
                </button>
            </div>
        </form>
      </div>
    </div>
  )
}