'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { name: 'Tenants', href: '/super-admin' },
  { name: 'Announcements', href: '/super-admin/announcements' },
  { name: 'Analytics', href: '/super-admin/analytics' },
]

export function SuperAdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isActive ? 'bg-blue-50 text-[var(--color-primary)]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
