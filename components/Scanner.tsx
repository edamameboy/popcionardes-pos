'use client'
import { useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import toast from 'react-hot-toast'

interface ScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function Scanner({ onScan, onClose }: ScannerProps) {
  const [zoom, setZoom] = useState(1)
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null)

  useEffect(() => {
    // Render instance
    const html5QrCode = new Html5Qrcode("reader")
    setScannerInstance(html5QrCode)

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      videoConstraints: {
          // TRIK IPHONE: Minta resolusi tinggi agar barcode tetap terbaca meski dari jauh
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "environment"
      }
    }

    html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      (decodedText) => {
        // Jika berhasil scan, bunyikan "Beep" (opsional) lalu tutup
        html5QrCode.stop().then(() => {
            onScan(decodedText)
        })
      },
      (error) => { /* Abaikan error frame pencarian */ }
    ).then(() => {
        // Coba apply Zoom 2.0x secara otomatis (jika HP mendukung) 
        // Ini membantu lensa utama iPhone fokus dari jarak jauh
        tryZoom(html5QrCode, 2)
    }).catch(err => {
        toast.error("Gagal membuka kamera. Pastikan izin kamera aktif.")
        onClose()
    })

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error)
      }
    }
  }, [])

  const tryZoom = (instance: Html5Qrcode, targetZoom: number) => {
    try {
        // Tambahkan "as any" di sini agar TypeScript tidak komplain
        instance.applyVideoConstraints({ advanced: [{ zoom: targetZoom } as any] })
        setZoom(targetZoom)
    } catch(e) {
        console.log("Fitur zoom tidak didukung oleh browser/device ini.")
    }
  }

  const handleManualZoom = (direction: 'in' | 'out') => {
      if (!scannerInstance) return
      let newZoom = direction === 'in' ? zoom + 1 : zoom - 1
      if (newZoom < 1) newZoom = 1
      if (newZoom > 5) newZoom = 5 // Max 5x zoom
      tryZoom(scannerInstance, newZoom)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
       {/* HEADER */}
       <div className="flex justify-between items-center p-4 bg-black/50 text-white absolute top-0 w-full z-10">
           <h3 className="font-bold tracking-widest">SCAN BARCODE</h3>
           <button onClick={onClose} className="p-2 bg-red-500 hover:bg-red-600 rounded-full">
               <X size={20} />
           </button>
       </div>

       {/* KOTAK SCANNER */}
       <div className="flex-1 flex flex-col justify-center items-center bg-black relative">
            <div id="reader" className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"></div>
            
            {/* INSTRUKSI IPHONE */}
            <p className="text-white text-xs text-center mt-6 px-8 opacity-70">
                Arahkan barcode ke kotak. Jika buram (susah fokus), jauhkan HP Anda lalu gunakan tombol Zoom.
            </p>
       </div>

       {/* CONTROLS (ZOOM) */}
       <div className="p-8 bg-black/80 flex justify-center gap-6 pb-safe">
           <button 
                onClick={() => handleManualZoom('out')} 
                className="w-14 h-14 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-transform border border-gray-600"
            >
               <ZoomOut size={24} />
           </button>
           
           <div className="flex flex-col items-center justify-center w-20 text-white font-bold text-xl">
               {zoom}x
           </div>

           <button 
                onClick={() => handleManualZoom('in')} 
                className="w-14 h-14 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-transform border border-gray-600"
            >
               <ZoomIn size={24} />
           </button>
       </div>
    </div>
  )
}