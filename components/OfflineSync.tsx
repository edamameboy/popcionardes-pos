'use client'
import { useEffect, useState } from 'react'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/utils/db'
import { createClient } from '@/utils/supabase/client'
import { Loader2, Wifi, WifiOff, DownloadCloud } from 'lucide-react' // Tambah icon DownloadCloud

export default function OfflineSync() {
  const network = useNetwork()
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [productCount, setProductCount] = useState(0) // Cek jumlah produk lokal
  const supabase = createClient()

  useEffect(() => {
    // Fungsi gabungan: Cek antrian upload & Download produk baru
    const runSyncRotine = async () => {
      // 1. Cek jumlah pending transaksi
      const count = await db.transactions.count()
      setPendingCount(count)
      
      // 2. Cek jumlah produk di lokal (untuk info saja)
      const pCount = await db.products.count()
      setProductCount(pCount)

      // JIKA ONLINE: Lakukan Sinkronisasi
      if (network.online && !isSyncing) {
        
        // A. Upload Transaksi Pending (Prioritas)
        if (count > 0) {
          await syncTransactions()
        }

        // B. Download Katalog Produk (Background)
        // Kita lakukan ini setiap kali online agar stok/harga selalu update
        await syncProductsCatalog()
      }
    }

    const interval = setInterval(runSyncRotine, 10000) // Cek setiap 10 detik
    runSyncRotine() // Jalankan saat mount
    
    return () => clearInterval(interval)
  }, [network.online, isSyncing])

  // --- FUNGSI 1: DOWNLOAD PRODUK (BARU) ---
  const syncProductsCatalog = async () => {
    try {
      // Ambil semua produk dari Supabase
      const { data, error } = await supabase.from('products').select('*')
      
      if (!error && data) {
        // Simpan ke Dexie (bulkPut = update jika ada, insert jika belum)
        await db.products.bulkPut(data)
        const newCount = await db.products.count()
        setProductCount(newCount)
        console.log("Katalog Produk Terupdate:", newCount, "items")
      }
    } catch (err) {
      console.error("Gagal download katalog:", err)
    }
  }

  // --- FUNGSI 2: UPLOAD TRANSAKSI (SAMA SEPERTI SEBELUMNYA) ---
  const syncTransactions = async () => {
    setIsSyncing(true)
    try {
      const offlineOrders = await db.transactions.toArray()
      for (const order of offlineOrders) {
        // ... (KODE UPLOAD SAMA SEPERTI SEBELUMNYA, TIDAK PERLU DIUBAH) ...
        // Copy logic upload foto, insert transaction, insert items, rpc decrement dari kode lama Anda
        
        // -- CONTOH SINGKAT BAGIAN INI (PASTIKAN KODE LAMA ANDA TETAP ADA DI SINI) --
        const uploadedUrls: string[] = []
        if (order.proofFiles && order.proofFiles.length > 0) {
            for (const fileBlob of order.proofFiles) {
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
                const { data } = await supabase.storage.from('pos-images').upload(fileName, fileBlob)
                if (data) uploadedUrls.push(data.path)
            }
        }
        
        const { data: trans, error: transError } = await supabase.from('transactions').insert({
            total_amount: order.total,
            payment_method: order.paymentMethod,
            location_event: order.location,
            proof_images: uploadedUrls,
            discount_type: order.discountType,
            discount_value: order.discountValue,
            user_id: order.userId,
            created_at: new Date(order.createdAt).toISOString()
        }).select().single()

        if (transError) throw transError

        const itemsData = order.cart.map((item: any) => ({
            transaction_id: trans.id,
            product_id: item.id,
            quantity: item.quantity,
            price_at_purchase: item.price
        }))
        await supabase.from('transaction_items').insert(itemsData)

        for (const item of order.cart) {
            await supabase.rpc('decrement_stock', { row_id: item.id, quantity_to_sub: item.quantity })
        }

        if (order.id) await db.transactions.delete(order.id)
        // -- END CONTOH SINGKAT --
      }
    } catch (error) {
      console.error("Gagal Sync Transaksi:", error)
    } finally {
      setIsSyncing(false)
      const count = await db.transactions.count()
      setPendingCount(count)
    }
  }

  return (
    <div className="fixed top-0 left-0 w-full z-[100] pointer-events-none flex justify-center pt-2 gap-2">
       {!network.online && (
         <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
           <WifiOff size={12} /> Mode Offline (Produk Tersedia: {productCount})
         </div>
       )}

       {isSyncing && (
         <div className="bg-pop-yellow text-black text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
           <Loader2 size={12} className="animate-spin" /> Sinkronisasi...
         </div>
       )}
       
       {network.online && !isSyncing && pendingCount > 0 && (
         <div className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
           <Wifi size={12} /> {pendingCount} Data Antri Upload
         </div>
       )}
    </div>
  )
}