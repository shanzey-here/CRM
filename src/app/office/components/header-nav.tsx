'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function HeaderNav({ role }: { role?: string }) {
  const pathname = usePathname()

  // Nav visibility is role-gated only, never entitlement-gated — a feature
  // not on the tenant's current plan still shows its link here; the
  // "upgrade to unlock" message renders on the destination page itself
  // (see isSocialModuleEnabled/isStorageModuleEnabled/isWorkflowModuleEnabled
  // and the PT403 checks in office/reports). Workflows is the one exception
  // that IS role-gated here, because its own layout.tsx hard-redirects
  // non-tenant_admins away (systemic automation rules are admin-only) —
  // matching that real destination restriction, not an entitlement check.
  const links = [
    { name: 'Dashboard', href: '/office', exact: true },
    { name: 'Leads', href: '/office/leads' },
    { name: 'Clients', href: '/office/clients' },
    { name: 'Scheduling', href: '/office/scheduling' },
    { name: 'Tasks', href: '/office/tasks' },
    { name: 'Jobs', href: '/office/jobs' },
    { name: 'Email', href: '/office/email' },
    { name: 'Social', href: '/office/social' },
    { name: 'Storage', href: '/office/storage' },
    { name: 'Reports', href: '/office/reports' },
    ...(role === 'tenant_admin' ? [{ name: 'Workflows', href: '/office/workflows' }] : []),
    { name: 'Settings', href: '/office/settings' },
  ]

  return (
    <nav className="ml-6 flex items-center justify-between w-full">
      <div className="flex space-x-8">
        {links.map((link) => {
          const isActive = link.exact 
            ? pathname === link.href 
            : pathname.startsWith(link.href)
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
      </div>
      
      <div className="ml-auto">
        <form action="/auth/signout" method="POST">
          <button 
            type="submit" 
            className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
          >
            Log Out
          </button>
        </form>
      </div>
    </nav>
  )
}
