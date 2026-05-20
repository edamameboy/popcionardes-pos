'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse' 
import { ArrowLeft, Calendar, MapPin, TrendingUp, BarChart3, Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function ReportPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'event'>('daily')
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  // MENGAMBIL DATA TRANSAKSI + DETAIL PRODUK YANG DIBELI
  const fetchData = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (
          quantity,
          price_at_purchase,
          products ( name )
        )
      `)
      .order('created_at', { ascending: true })

    if (error) console.error("Error fetch data:", error)
    if (data) setTransactions(data)
    
    setLoading(false)
  }

  // --- LOGIKA PENGOLAHAN DATA UNTUK GRAFIK (REKAP) ---
  const chartData = useMemo(() => {
    if (transactions.length === 0) return []

    const groupedData: Record<string, number> = {}

    transactions.forEach(t => {
      const date = new Date(t.created_at)
      let key = ''

      if (filterType === 'daily') {
        key = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      } else if (filterType === 'monthly') {
        key = date.toLocaleDateString('id-ID', { month: 'long' })
      } else if (filterType === 'event') {
        key = t.location_event || 'Umum/Toko'
      }

      groupedData[key] = (groupedData[key] || 0) + t.total_amount
    })

    return Object.keys(groupedData).map(key => ({
      name: key,
      total: groupedData[key]
    }))
  }, [transactions, filterType])

  const totalRevenue = chartData.reduce((acc, curr) => acc + curr.total, 0)

  // --- FUNGSI EXPORT LAPORAN KE CSV (DIPERBARUI) ---
  const handleExportReport = () => {
    if (chartData.length === 0) return alert("Tidak ada data untuk diexport.")

    let csvData: any[] = []

    if (filterType === 'daily') {
      // 1. FORMAT EXPORT DETAIL (HARIAN)
      transactions.forEach((t) => {
        const dateStr = new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
        const timeStr = new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        
        // Cek jika ada item produk di dalam transaksi
        if (t.transaction_items && t.transaction_items.length > 0) {
          t.transaction_items.forEach((item: any) => {
            csvData.push({
              'Tanggal': dateStr,
              'Waktu': timeStr,
              'Lokasi / Event': t.location_event || 'Umum/Toko',
              'Metode Bayar': t.payment_method === 'cash' ? 'Cash' : 'Transfer',
              'Nama Produk': item.products?.name || 'Produk Dihapus',
              'Harga Satuan (Rp)': item.price_at_purchase,
              'Qty Terjual': item.quantity,
              'Subtotal (Rp)': item.price_at_purchase * item.quantity,
              'Diskon Nota': t.discount_value > 0 ? `${t.discount_value} ${t.discount_type === 'percent' ? '%' : 'Rp'}` : '0',
              'Total Bayar Akhir (Rp)': t.total_amount
            })
          })
        }
      })
    } else {
      // 2. FORMAT EXPORT REKAP (BULANAN & EVENT)
      let kolomKategori = filterType === 'monthly' ? 'Bulan' : 'Nama Event / Lokasi'
      csvData = chartData.map((item, index) => ({
        'No': index + 1,
        [kolomKategori]: item.name,
        'Total Penjualan (Rp)': item.total
      }))
    }

    // Mengubah JSON ke format string CSV
    const csvString = Papa.unparse(csvData)

    // Proses download file browser
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    
    const namaFile = `Laporan_Omset_${filterType === 'daily' ? 'Harian_Detail' : filterType === 'monthly' ? 'Bulanan' : 'Event'}_${new Date().toISOString().split('T')[0]}.csv`
    
    link.setAttribute("href", url)
    link.setAttribute("download", namaFile)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const COLORS = ['#00a651', '#00C49F', '#FFBB28', '#FF8042', '#0088FE']

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 transition-colors">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-600 dark:text-white">
              <ArrowLeft size={24} />
          </button>
          <h1 className="font-bold text-lg text-gray-800 dark:text-white">Laporan Penjualan</h1>
        </div>
        
        {/* TOMBOL EXPORT */}
        {!loading && chartData.length > 0 && (
          <button 
            onClick={handleExportReport}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-sm font-bold shadow transition-all"
            title="Download Laporan CSV"
          >
            <Download size={16} /> <span>Export</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-6">
        
        {/* TOTAL SALES CARD */}
        <div className="bg-gradient-to-r from-pop-green to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-200 dark:shadow-none">
            <div className="flex items-center gap-2 opacity-90 mb-1">
                <TrendingUp size={20}/>
                <span className="text-sm font-medium">Total Omset ({filterType === 'daily' ? 'Periode Ini' : filterType === 'monthly' ? 'Tahun Ini' : 'Semua Event'})</span>
            </div>
            <div className="text-3xl font-bold">
                Rp {totalRevenue.toLocaleString()}
            </div>
        </div>

        {/* FILTER BUTTONS */}
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border dark:border-slate-700">
            {[
                { id: 'daily', label: 'Harian', icon: Calendar },
                { id: 'monthly', label: 'Bulanan', icon: BarChart3 },
                { id: 'event', label: 'Event', icon: MapPin },
            ].map((f) => (
                <button
                    key={f.id}
                    onClick={() => setFilterType(f.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        filterType === f.id 
                        ? 'bg-pop-green text-white shadow-md' 
                        : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-400'
                    }`}
                >
                    <f.icon size={16} /> {f.label}
                </button>
            ))}
        </div>

        {/* GRAFIK CHART */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 h-80">
            <h3 className="font-bold text-gray-700 dark:text-white mb-4 text-sm">Grafik Penjualan</h3>
            
            {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Memuat data...</div>
            ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">Belum ada data transaksi</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#9CA3AF'}} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tickFormatter={(value) => `${(value / 1000)}k`} 
                            tick={{fontSize: 10, fill: '#9CA3AF'}} 
                        />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: any) => [`Rp ${Number(value).toLocaleString()}`, 'Omset']}
                        />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={filterType === 'event' ? COLORS[index % COLORS.length] : '#00a651'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>

        {/* LIST DETAIL */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
             <div className="p-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                <h3 className="font-bold text-gray-700 dark:text-white text-sm">Rincian Data</h3>
             </div>
             <div>
                {chartData.sort((a,b) => b.total - a.total).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 border-b last:border-0 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded-full text-xs font-bold text-gray-500">
                                {idx + 1}
                            </span>
                            <span className="font-medium text-gray-700 dark:text-gray-200">{item.name}</span>
                        </div>
                        <span className="font-bold text-pop-green">Rp {item.total.toLocaleString()}</span>
                    </div>
                ))}
                {chartData.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">Tidak ada data</div>}
             </div>
        </div>

      </div>
    </div>
  )
}