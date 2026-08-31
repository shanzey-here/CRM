'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Calendar, 
  CalendarCheck,
  CheckSquare, 
  Truck, 
  Mail, 
  Share2, 
  Archive, 
  BarChart3, 
  Workflow, 
  Settings 
} from 'lucide-react'

export function SidebarNav({ role }: { role?: string }) {
  const pathname = usePathname()

  const links = [
    { name: 'Dashboard', href: '/office', icon: LayoutDashboard, exact: true },
    { name: 'Leads', href: '/office/leads', icon: Users },
    { name: 'Bookings', href: '/office/jobs/confirmed', icon: CalendarCheck },
    { name: 'Clients', href: '/office/clients', icon: Building2 },
    { name: 'Scheduling', href: '/office/scheduling', icon: Calendar },
    { name: 'Tasks', href: '/office/tasks', icon: CheckSquare },
    { 
      name: 'Jobs', 
      href: '/office/jobs', 
      icon: Truck, 
      isActiveCustom: (path: string) => path === '/office/jobs' || (path.startsWith('/office/jobs/') && !path.startsWith('/office/jobs/confirmed'))
    },
    { name: 'Email', href: '/office/email', icon: Mail },
    { name: 'Social', href: '/office/social', icon: Share2 },
    { name: 'Storage', href: '/office/storage', icon: Archive },
    { name: 'Reports', href: '/office/reports', icon: BarChart3 },
    ...(role === 'tenant_admin' ? [{ name: 'Workflows', href: '/office/workflows', icon: Workflow }] : []),
    { name: 'Settings', href: '/office/settings', icon: Settings },
  ]

  return (
    <nav className="flex flex-col space-y-1 w-full">
      {links.map((link) => {
        const isActive = link.isActiveCustom
          ? link.isActiveCustom(pathname)
          : link.exact 
          ? pathname === link.href 
          : pathname.startsWith(link.href)
        
        const Icon = link.icon
          
        return (
          <Link
            key={link.name}
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Icon size={18} className={isActive ? "text-emerald-700 dark:text-emerald-400" : "text-sidebar-foreground/40"} />
            {link.name}
          </Link>
        )
      })}
    </nav>
  )
}
