'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DollarSign, Package, TrendingUp, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link' // Import Link untuk navigasi lebih cepat

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    dailyIncome: 0,
    totalTransactions: 0
  })
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    // 1. Cek User & Ambil Nama
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserName(user.user_metadata?.full_name || 'User')

    // 2. Hitung Total Produk
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // 3. Hitung Pendapatan & Transaksi Hari Ini
    // Menggunakan T00:00:00 agar menghitung dari awal hari ini
    const today = new Date().toISOString().split('T')[0] 
    const { data: transactions } = await supabase
      .from('transactions')
      .select('total_amount')
      .gte('created_at', `${today}T00:00:00`) 

    const income = transactions?.reduce((sum, t) => sum + t.total_amount, 0) || 0

    setStats({
      totalProducts: productCount || 0,
      dailyIncome: income,
      totalTransactions: transactions?.length || 0
    })
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-24 transition-colors">
      {/* HEADER */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Halo, {userName} 👋</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ringkasan toko hari ini</p>
      </header>

      {/* GRID STATISTIK */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        
        {/* 1. KARTU OMSET (Full Width) -> Link ke Report */}
        <Link href="/report" className="col-span-2">
          <div className="bg-gradient-to-r from-pop-green to-emerald-600 p-5 rounded-2xl text-white shadow-lg shadow-green-200 dark:shadow-none cursor-pointer hover:scale-[1.01] transition-transform">
            <div className="flex items-center gap-2 mb-2 opacity-90">
                <DollarSign size={20} />
                <span className="text-sm font-medium">Omset Hari Ini</span>
            </div>
            <div className="text-3xl font-bold">
                {loading ? '...' : `Rp ${stats.dailyIncome.toLocaleString()}`}
            </div>
            <div className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full">
                Klik untuk lihat grafik
            </div>
          </div>
        </Link>
        
        {/* 2. KARTU TRANSAKSI -> Link ke History */}
        <Link href="/transactions">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700 h-full flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
                <TrendingUp size={20} />
                <span className="text-xs font-bold uppercase">Transaksi</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                  {loading ? '...' : stats.totalTransactions}
              </div>
              <p className="text-[10px] text-gray-400">Order masuk hari ini</p>
            </div>
          </div>
        </Link>
        
        {/* 3. KARTU PRODUK -> Link ke Inventory */}
        <Link href="/inventory">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700 h-full flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center gap-2 text-orange-500 mb-2">
                <Package size={20} />
                <span className="text-xs font-bold uppercase">Produk</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                  {loading ? '...' : stats.totalProducts}
              </div>
              <p className="text-[10px] text-gray-400">Total item stok</p>
            </div>
          </div>
        </Link>
      </div>
      
      {/* TOMBOL QUICK ACTION (KASIR) */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg dark:shadow-none">
        <div className="flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg">Buka Kasir</h3>
                <p className="text-blue-100 text-xs mb-4 max-w-[200px]">Mulai transaksi penjualan baru sekarang.</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
                <ShoppingBag size={24} className="text-white"/>
            </div>
        </div>
        <button 
          onClick={() => router.push('/pos')}
          className="w-full bg-white text-blue-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-100 transition shadow-sm"
        >
          Masuk ke Kasir
        </button>
      </div>
    </div>
  )
}