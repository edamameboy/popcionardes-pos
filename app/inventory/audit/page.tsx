'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function AuditTrail() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('stock_adjustments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100) // Ambil 100 riwayat terbaru

    if (error) console.error("Error fetching logs:", error)
    if (data) setLogs(data)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 transition-colors select-none">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-30 shadow-sm flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-600 dark:text-white transition-colors">
            <ArrowLeft size={24} />
        </button>
        <div>
            <h1 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                Riwayat Opname
            </h1>
            <p className="text-[10px] text-gray-500">Log perubahan stok manual</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
            <div className="text-center text-gray-500 py-10">Memuat log...</div>
        ) : logs.length === 0 ? (
            <div className="text-center text-gray-400 py-10 bg-white dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">
                <ClipboardList size={40} className="mx-auto mb-2 opacity-50"/>
                Belum ada riwayat penyesuaian stok.
            </div>
        ) : (
            logs.map((log) => {
                const isLoss = log.difference < 0
                const isGain = log.difference > 0
                
                return (
                    <div key={log.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-sm dark:text-white mb-1">{log.product_name}</div>
                                <div className="text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded inline-block font-medium">
                                    Oleh: {log.user_name}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-gray-400 mb-1">
                                    {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border dark:border-slate-700/50">
                            <div className="text-center">
                                <div className="text-[10px] text-gray-500 uppercase">Sistem</div>
                                <div className="font-bold dark:text-white">{log.old_stock}</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-[10px] text-gray-500 uppercase">Selisih</div>
                                <div className={`font-bold text-sm flex items-center gap-1 ${isLoss ? 'text-red-500' : isGain ? 'text-green-500' : 'text-gray-500'}`}>
                                    {isLoss ? <TrendingDown size={14}/> : isGain ? <TrendingUp size={14}/> : <Minus size={14}/>}
                                    {log.difference > 0 ? `+${log.difference}` : log.difference}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-gray-500 uppercase">Fisik (Baru)</div>
                                <div className="font-bold dark:text-white">{log.new_stock}</div>
                            </div>
                        </div>

                        <div className="text-xs text-gray-600 dark:text-gray-300">
                            <span className="font-bold text-gray-400">Alasan:</span> {log.reason}
                        </div>
                    </div>
                )
            })
        )}
      </div>
    </div>
  )
}