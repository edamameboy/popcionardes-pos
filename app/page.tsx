'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DollarSign, Package, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
    const today = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
    const { data: transactions } = await supabase
      .from('transactions')
      .select('total_amount')
      .gte('created_at', `${today}T00:00:00`) // Dari jam 00:00 hari ini

    const income = transactions?.reduce((sum, t) => sum + t.total_amount, 0) || 0

    setStats({
      totalProducts: productCount || 0,
      dailyIncome: income,
      totalTransactions: transactions?.length || 0
    })
    setLoading(false)
  }

  // Komponen Kartu Statistik (Updated dengan onClick)
  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all
        ${onClick ? 'cursor-pointer hover:bg-blue-50 hover:shadow-md active:scale-95' : ''}
      `}
    >
      <div className={`p-3 rounded-full ${color} text-white`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <h3 className="text-xl font-bold text-gray-800">{loading ? '...' : value}</h3>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 transition-colors">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Halo, {userName} 👋</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ringkasan toko hari ini</p>
      </header>

      <div className="grid gap-4">
        {/* Omset (Tidak ada link spesifik, jadi tidak dikasih onClick) */}
        <StatCard 
          title="Omset Hari Ini" 
          value={`Rp ${stats.dailyIncome.toLocaleString()}`} 
          icon={DollarSign} 
          color="bg-green-500" 
        />
        
        {/* Total Transaksi -> Ke Halaman Transaksi */}
        <StatCard 
          title="Transaksi Hari Ini" 
          value={`${stats.totalTransactions} Order`} 
          icon={TrendingUp} 
          color="bg-blue-500"
          onClick={() => router.push('/transactions')} 
        />
        
        {/* Total Produk -> Ke Halaman Inventory */}
        <StatCard 
          title="Total Produk" 
          value={`${stats.totalProducts} Item`} 
          icon={Package} 
          color="bg-orange-500"
          onClick={() => router.push('/inventory')} 
        />
      </div>
      
      {/* Area Promo / Akses Cepat */}
      <div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl text-white shadow-lg">
        <h3 className="font-bold text-lg">Siap Berjualan?</h3>
        <p className="text-blue-100 text-sm mb-4">Buka menu kasir untuk mulai transaksi baru.</p>
        <button 
          onClick={() => router.push('/pos')}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition"
        >
          Buka Kasir
        </button>
      </div>
    </div>
  )
}