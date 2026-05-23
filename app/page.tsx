'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DollarSign, Package, TrendingUp, ClipboardList, Award, ChevronRight, Moon, Sun } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes' // Library Tema
import toast from 'react-hot-toast' // Library Notifikasi

export default function Dashboard() {
  const [stats, setStats] = useState({ totalProducts: 0, dailyIncome: 0, totalTransactions: 0 })
  const [topProducts, setTopProducts] = useState<{name: string, qty: number}[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [mounted, setMounted] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (!user || authErr) { router.push('/login'); return }
        setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'User')

        const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true })

        const today = new Date().toISOString().split('T')[0] 
        const { data: transactions } = await supabase.from('transactions').select('total_amount').gte('created_at', `${today}T00:00:00`) 
        const income = transactions?.reduce((sum, t) => sum + t.total_amount, 0) || 0

        const { data: transItems } = await supabase.from('transaction_items').select('quantity, products(name)')
        let topSelling: {name: string, qty: number}[] = []
        if (transItems) {
            const counts: Record<string, number> = {}
            transItems.forEach((item: any) => { 
                const productInfo = Array.isArray(item.products) ? item.products[0] : item.products
                const pName = productInfo?.name || 'Produk Terhapus'
                counts[pName] = (counts[pName] || 0) + item.quantity
            })
            topSelling = Object.entries(counts).map(([name, qty]) => ({ name, qty: qty as number })).sort((a, b) => b.qty - a.qty).slice(0, 5) 
        }

        setStats({ totalProducts: productCount || 0, dailyIncome: income, totalTransactions: transactions?.length || 0 })
        setTopProducts(topSelling)
    } catch (err) {
        toast.error("Gagal memuat beberapa data.")
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-24 transition-colors duration-300 ease-in-out select-none">
      {/* HEADER DENGAN TOMBOL TEMA */}
      <header className="mb-6 mt-2 flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white transition-colors">Halo, {userName} 👋</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Ringkasan toko hari ini</p>
        </div>
        
        {/* TOMBOL TOGGLE THEME */}
        {mounted && (
            <button 
                onClick={() => {
                    setTheme(theme === 'dark' ? 'light' : 'dark')
                    toast.success(`Mode ${theme === 'dark' ? 'Terang' : 'Gelap'} diaktifkan!`, { icon: theme === 'dark' ? '☀️' : '🌙' })
                }}
                className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:scale-105 active:scale-95 transition-all"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        )}
      </header>

      {/* 1. KARTU OMSET */}
      <Link href="/report" className="block mb-3">
        <div className="bg-gradient-to-br from-pop-green to-emerald-600 p-5 rounded-2xl text-white shadow-lg shadow-green-200 dark:shadow-none cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-2 mb-2 opacity-90">
              <DollarSign size={20} />
              <span className="text-sm font-medium">Omset Hari Ini</span>
          </div>
          <div className="text-3xl font-bold">
              {loading ? '...' : `Rp ${stats.dailyIncome.toLocaleString()}`}
          </div>
          <div className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full backdrop-blur-sm">
              Klik untuk lihat laporan lengkap
          </div>
        </div>
      </Link>

      {/* 2. GRID MENU CEPAT */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/transactions">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 h-full flex flex-col justify-between hover:bg-blue-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all group">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
                <TrendingUp size={18} className="group-hover:scale-110 transition-transform"/>
                <span className="text-[11px] font-bold uppercase tracking-wider">Transaksi</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white transition-colors">{loading ? '...' : stats.totalTransactions}</div>
              <p className="text-[10px] text-gray-400">Order masuk hari ini</p>
            </div>
          </div>
        </Link>
        
        <Link href="/inventory">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 h-full flex flex-col justify-between hover:bg-orange-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all group">
            <div className="flex items-center gap-2 text-orange-500 mb-2">
                <Package size={18} className="group-hover:scale-110 transition-transform"/>
                <span className="text-[11px] font-bold uppercase tracking-wider">Inventory</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white transition-colors">{loading ? '...' : stats.totalProducts}</div>
              <p className="text-[10px] text-gray-400">Total item aktif</p>
            </div>
          </div>
        </Link>

        {/* MENU OPNAME */}
        <Link href="/inventory/audit" className="col-span-2">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between hover:bg-purple-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                    <ClipboardList size={20} />
                </div>
                <div>
                    <div className="font-bold text-sm text-gray-800 dark:text-white transition-colors">Riwayat Opname</div>
                    <div className="text-[10px] text-gray-500">Log perubahan & selisih stok</div>
                </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </Link>
      </div>
      
      {/* 3. DAFTAR PRODUK TERLARIS */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-gray-800 dark:text-white font-bold text-sm">
                <Award size={18} className="text-yellow-500" /> Produk Terlaris
            </div>
            <span className="text-[10px] text-gray-500 bg-gray-200 dark:bg-slate-700 px-2 py-1 rounded transition-colors">All Time</span>
        </div>
        
        <div className="p-2">
            {loading ? (
                <div className="text-center py-6 text-xs text-gray-400">Menganalisa data...</div>
            ) : topProducts.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">Belum ada data penjualan.</div>
            ) : (
                topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border-b last:border-0 border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold 
                                ${index === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' : 
                                  index === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 
                                  index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                                  'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500'}`}>
                                {index + 1}
                            </span>
                            <span className="font-medium text-sm text-gray-700 dark:text-gray-200 line-clamp-1 transition-colors">
                                {product.name}
                            </span>
                        </div>
                        <div className="font-bold text-sm text-pop-green whitespace-nowrap bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                            {product.qty} <span className="text-[10px] text-green-600/70 dark:text-green-400/70 font-normal ml-0.5">Terjual</span>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  )
}