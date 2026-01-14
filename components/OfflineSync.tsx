'use client'
import { useEffect, useState } from 'react'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'
import { createClient } from '@/utils/supabase/client'
import { Loader2, Wifi, WifiOff } from 'lucide-react'

export default function OfflineSync() {
  const network = useNetwork() // Cek status internet
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const supabase = createClient()

  // 1. Cek jumlah data pending setiap kali ada perubahan atau internet nyala
  useEffect(() => {
    const checkPending = async () => {
      const count = await db.transactions.count()
      setPendingCount(count)
      
      // Jika online dan ada data pending, jalankan sync
      if (network.online && count > 0 && !isSyncing) {
        syncData()
      }
    }
    
    // Interval cek setiap 5 detik (opsional) atau trigger manual
    const interval = setInterval(checkPending, 5000)
    checkPending() // Cek awal
    
    return () => clearInterval(interval)
  }, [network.online, isSyncing])

  // 2. Fungsi Utama Sinkronisasi
  const syncData = async () => {
    setIsSyncing(true)
    try {
      // Ambil semua data offline
      const offlineOrders = await db.transactions.toArray()

      for (const order of offlineOrders) {
        console.log("Syncing order...", order)

        // A. Upload Foto Dulu (Jika ada)
        const uploadedUrls: string[] = []
        if (order.proofFiles && order.proofFiles.length > 0) {
          for (const fileBlob of order.proofFiles) {
             // Convert Blob kembali ke File jika perlu, atau upload langsung
             const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
             const { data } = await supabase.storage.from('pos-images').upload(fileName, fileBlob)
             if (data) uploadedUrls.push(data.path)
          }
        }

        // B. Insert Transaksi ke Supabase
        const { data: trans, error: transError } = await supabase
          .from('transactions')
          .insert({
            total_amount: order.total,
            payment_method: order.paymentMethod,
            location_event: order.location,
            proof_images: uploadedUrls,
            discount_type: order.discountType,
            discount_value: order.discountValue,
            user_id: order.userId,
            created_at: new Date(order.createdAt).toISOString() // Pakai waktu asli saat input offline
          })
          .select()
          .single()

        if (transError) throw transError

        // C. Insert Items
        const itemsData = order.cart.map((item: any) => ({
          transaction_id: trans.id,
          product_id: item.id,
          quantity: item.quantity,
          price_at_purchase: item.price
        }))
        await supabase.from('transaction_items').insert(itemsData)

        // D. Update Stok (Hati-hati, bisa minus jika stok server habis duluan)
        for (const item of order.cart) {
          await supabase.rpc('decrement_stock', { row_id: item.id, quantity_to_sub: item.quantity })
        }

        // E. Hapus dari database lokal jika sukses
        if (order.id) await db.transactions.delete(order.id)
      }

    } catch (error) {
      console.error("Gagal Sync:", error)
    } finally {
      setIsSyncing(false)
      // Update count
      const count = await db.transactions.count()
      setPendingCount(count)
    }
  }

  // Tampilan Indikator Sinyal Kecil
  return (
    <div className="fixed top-0 left-0 w-full z-[100] pointer-events-none flex justify-center pt-2">
       {/* Alert jika Offline */}
       {!network.online && (
         <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
           <WifiOff size={12} /> Mode Offline
         </div>
       )}

       {/* Alert jika sedang Sync */}
       {isSyncing && (
         <div className="bg-pop-yellow text-black text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
           <Loader2 size={12} className="animate-spin" /> Sinkronisasi data...
         </div>
       )}
       
       {/* Alert jika Online tapi ada data antri (pending) */}
       {network.online && !isSyncing && pendingCount > 0 && (
         <div className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
           <Wifi size={12} /> {pendingCount} Data Antri Upload
         </div>
       )}
    </div>
  )
}