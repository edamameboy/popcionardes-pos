'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Package, User, FileText } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (data?.role === 'admin') setIsAdmin(true)
      }
    }
    checkRole()
  }, [])

  if (pathname === '/login' || pathname === '/register') return null

  // Menu Dasar
  const menus = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Kasir', href: '/pos', icon: ShoppingCart },
    { name: 'Stok', href: '/inventory', icon: Package },
  ]

  // Tambahkan Menu Admin jika user adalah Admin
  if (isAdmin) {
    menus.push({ name: 'Trans.', href: '/transactions', icon: FileText })
  }

  // Profil selalu ada di akhir
  menus.push({ name: 'Profil', href: '/profile', icon: User })

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-lg transition-colors">
      <div className={`grid h-full mx-auto font-medium ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
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