import Image from 'next/image'

export default function Loading() {
  return (
    // Container: Full layar, tengah, background mengikuti tema
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors">
      
      {/* Logo dengan animasi pulse (berdenyut halus) */}
      <div className="relative w-48 h-48 animate-pulse-slow">
        <Image 
          src="/logo-full.png" // Pastikan file ini ada di folder public/
          alt="POP CIONARDES TOYS Logo"
          fill
          className="object-contain drop-shadow-xl"
          priority // Load prioritas tinggi
        />
      </div>
      
      {/* Loading Spinner kecil di bawahnya dengan warna hijau logo */}
      <div className="mt-8 flex items-center gap-2">
        <div className="h-3 w-3 bg-pop-green rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="h-3 w-3 bg-pop-green rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="h-3 w-3 bg-pop-green rounded-full animate-bounce"></div>
      </div>
      
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-4 font-medium animate-pulse">
        Memuat Aplikasi...
      </p>
    </div>
  )
}