'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function HeaderNav() {
  const pathname = usePathname()

  const links = [
    { name: 'Leads', href: '/office/leads' },
    { name: 'Clients', href: '/office/clients' },
    { name: 'Scheduling', href: '/office/scheduling' },
    { name: 'Tasks', href: '/office/tasks' },
    { name: 'Jobs', href: '/office/jobs' },
    { name: 'Settings', href: '/office/settings' },
  ]

  return (
    <nav className="ml-6 flex space-x-8">
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href)
        return (
          <Link
            key={link.name}
            href={link.href}
            className={cn(
              "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium",
              isActive 
                ? "border-emerald-500 text-slate-900" 
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {link.name}
          </Link>
        )
      })}
    </nav>
  )
}
