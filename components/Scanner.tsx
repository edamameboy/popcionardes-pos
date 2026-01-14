'use client'
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { X } from 'lucide-react'

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void
  onClose: () => void
}

const qrcodeRegionId = "reader-container";

export default function Scanner({ onScanSuccess, onClose }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(qrcodeRegionId)
    }
    
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      formatsToSupport: [ 
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128, 
        Html5QrcodeSupportedFormats.EAN_13, 
        Html5QrcodeSupportedFormats.UPC_A 
      ]
    }

    scannerRef.current.start(
      { facingMode: "environment" }, 
      config,
      (decodedText) => {
        onScanSuccess(decodedText)
        handleStop()
      },
      (err) => { /* ignore frame errors */ }
    ).catch(err => {
      console.error(err)
      setErrorMsg("Gagal akses kamera. Cek izin browser.")
    })

    return () => { handleStop() }
  }, [])

  const handleStop = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop()
        .then(() => scannerRef.current?.clear())
        .catch(console.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden relative">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800">Scan Barcode</h3>
          <button onClick={() => { handleStop(); onClose(); }}><X className="text-gray-600" /></button>
        </div>
        <div className="relative bg-black min-h-[300px]">
           <div id={qrcodeRegionId} className="w-full" />
           {errorMsg && <p className="absolute top-1/2 w-full text-center text-red-500 font-bold px-4">{errorMsg}</p>}
        </div>
      </div>
    </div>
  )
}