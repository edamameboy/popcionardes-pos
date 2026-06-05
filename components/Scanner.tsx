'use client'
import { useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, ZoomIn, ZoomOut, Camera as CameraIcon } from 'lucide-react'
import toast from 'react-hot-toast'

interface ScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function Scanner({ onScan, onClose }: ScannerProps) {
  const [zoom, setZoom] = useState(1)
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null)
  
  // State untuk menyimpan daftar kamera dan kamera yang sedang dipilih
  const [cameras, setCameras] = useState<{id: string, label: string}[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')

  // 1. Inisiasi Scanner dan Ambil Daftar Kamera
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader")
    setScannerInstance(html5QrCode)

    // Meminta izin dan mengambil semua lensa kamera yang ada di HP
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices)
        
        // Coba cari kamera yang ada kata "back" (belakang), jika tidak ada pakai kamera pertama
        const backCamera = devices.find(c => c.label.toLowerCase().includes('back'))
        setSelectedCameraId(backCamera ? backCamera.id : devices[0].id)
      }
    }).catch(err => {
      toast.error("Gagal mendapatkan daftar kamera. Pastikan izin kamera aktif.")
    })

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error)
      }
    }
  }, [])

  // 2. Jalankan Kamera saat Kamera Dipilih / Diganti
  useEffect(() => {
    if (!scannerInstance || !selectedCameraId) return

    const startScanner = async () => {
      // Jika kamera sedang nyala (karena user ganti lensa), matikan dulu
      if (scannerInstance.isScanning) {
        await scannerInstance.stop().catch(console.error)
      }

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        videoConstraints: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }

      // Mulai scan menggunakan ID KAMERA SPESIFIK yang dipilih
      scannerInstance.start(
        selectedCameraId, 
        config, 
        (decodedText) => {
          scannerInstance.stop().then(() => {
              onScan(decodedText)
          })
        },
        (error) => { /* Abaikan error frame */ }
      ).then(() => {
          tryZoom(scannerInstance, 2)
      }).catch(err => {
          console.error("Gagal start kamera:", err)
      })
    }

    startScanner()
  }, [scannerInstance, selectedCameraId])

  const tryZoom = (instance: Html5Qrcode, targetZoom: number) => {
    try {
        instance.applyVideoConstraints({ advanced: [{ zoom: targetZoom } as any] })
        setZoom(targetZoom)
    } catch(e) {
        // Fitur zoom diabaikan jika lensa tidak mendukung
    }
  }

  const handleManualZoom = (direction: 'in' | 'out') => {
      if (!scannerInstance) return
      let newZoom = direction === 'in' ? zoom + 1 : zoom - 1
      if (newZoom < 1) newZoom = 1
      if (newZoom > 5) newZoom = 5 
      tryZoom(scannerInstance, newZoom)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
       {/* HEADER & PILIHAN KAMERA */}
       <div className="p-4 bg-black/80 text-white absolute top-0 w-full z-10 space-y-3 pb-4">
           <div className="flex justify-between items-center">
               <h3 className="font-bold tracking-widest flex items-center gap-2">
                   <CameraIcon size={18}/> SCAN BARCODE
               </h3>
               <button onClick={onClose} className="p-2 bg-red-500 hover:bg-red-600 rounded-full">
                   <X size={20} />
               </button>
           </div>
           
           {/* DROPDOWN PEMILIH LENSA KAMERA */}
           {cameras.length > 1 && (
               <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 flex items-center gap-2">
                   <span className="text-xs text-gray-400 whitespace-nowrap">Lensa:</span>
                   <select 
                       className="bg-transparent text-sm font-medium w-full outline-none truncate"
                       value={selectedCameraId}
                       onChange={(e) => setSelectedCameraId(e.target.value)}
                   >
                       {cameras.map((cam, idx) => (
                           <option key={cam.id} value={cam.id} className="text-black">
                               {cam.label || `Kamera ${idx + 1}`}
                           </option>
                       ))}
                   </select>
               </div>
           )}
       </div>

       {/* KOTAK SCANNER */}
       <div className="flex-1 flex flex-col justify-center items-center bg-black relative pt-20">
            <div id="reader" className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-gray-900 min-h-[250px]"></div>
            
            <p className="text-white text-xs text-center mt-6 px-8 opacity-70">
                Arahkan barcode ke kotak. Jika buram, ganti "Lensa" di atas atau gunakan Zoom.
            </p>
       </div>

       {/* CONTROLS (ZOOM) */}
       <div className="p-8 bg-black/80 flex justify-center gap-6 pb-safe relative z-10">
           <button 
                onClick={() => handleManualZoom('out')} 
                className="w-14 h-14 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-transform border border-gray-600 shadow-lg"
            >
               <ZoomOut size={24} />
           </button>
           
           <div className="flex flex-col items-center justify-center w-20 text-white font-bold text-xl">
               {zoom}x
           </div>

           <button 
                onClick={() => handleManualZoom('in')} 
                className="w-14 h-14 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-transform border border-gray-600 shadow-lg"
            >
               <ZoomIn size={24} />
           </button>
       </div>
    </div>
  )
}