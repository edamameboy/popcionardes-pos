'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ShoppingCart, Package, User, FileText } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  // Sembunyikan nav di halaman login/register
  if (pathname === '/login' || pathname === '/register') return null

  // Menu STATIS (Selalu 5 item untuk semua user)
  const menus = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Kasir', href: '/pos', icon: ShoppingCart },
    { name: 'Stok', href: '/inventory', icon: Package },
    { name: 'Trans.', href: '/transactions', icon: FileText }, 
    { name: 'Profil', href: '/profile', icon: User },
  ]

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-lg transition-colors">
      {/* GRID SELALU 5 KOLOM */}
      <div className="grid h-full mx-auto font-medium grid-cols-5">
        {menus.map((menu) => {
          const isActive = pathname === menu.href
          return (
            <Link 
                key={menu.name} 
                href={menu.href}
                className={`inline-flex flex-col items-center justify-center px-2 hover:bg-gray-100 dark:hover:bg-slate-700 group transition-colors ${isActive ? 'text-pop-green font-bold' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <menu.icon size={22} className={isActive ? 'stroke-2' : 'stroke-1'} />
              <span className="text-[10px] mt-1">{menu.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}