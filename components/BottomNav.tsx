'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ShoppingCart, Package, User, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setRole(data?.role || 'kasir') // Default aman
      }
    }
    fetchRole()
  }, [pathname]) 

  // Sembunyikan nav di halaman login/register
  if (pathname === '/login' || pathname === '/register') return null

  // DAFTAR MENU DINAMIS BERDASARKAN ROLE
  const menus = [
    // Dashboard HANYA untuk Admin
    ...(role === 'admin' ? [{ name: 'Home', href: '/', icon: LayoutDashboard }] : []),
    
    // Kasir & Transaksi untuk Admin dan Kasir
    ...(role === 'admin' || role === 'kasir' ? [
        { name: 'Kasir', href: '/pos', icon: ShoppingCart },
        { name: 'Trans.', href: '/transactions', icon: FileText }
    ] : []),

    // Inventory untuk Admin dan Gudang
    ...(role === 'admin' || role === 'gudang' ? [
        { name: 'Stok', href: '/inventory', icon: Package }
    ] : []),

    // Profile untuk Semua
    { name: 'Profil', href: '/profile', icon: User }
  ]

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-5xl bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex justify-around p-3 pb-safe z-50 transition-colors duration-300">
      <div className={`grid h-full mx-auto font-medium w-full`} style={{ gridTemplateColumns: `repeat(${menus.length}, minmax(0, 1fr))` }}>
        {menus.map((menu) => {
          const isActive = pathname === menu.href || (pathname.startsWith(menu.href) && menu.href !== '/')
          return (
            <Link 
                key={menu.name} 
                href={menu.href}
                className={`inline-flex flex-col items-center justify-center px-2 hover:bg-gray-100 dark:hover:bg-slate-700 group transition-colors ${isActive ? 'text-pop-green font-bold' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <menu.icon size={22} className={isActive ? 'stroke-2 drop-shadow-md scale-110 transition-transform' : 'stroke-1'} />
              <span className="text-[10px] mt-1">{menu.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}