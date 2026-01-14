'use client'
import { useState, useEffect } from 'react';

export function useNetwork() {
  // Default true agar tidak nge-flash "Offline" saat pertama load
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Pastikan kode hanya jalan di browser (bukan server)
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine);

      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return { online };
}