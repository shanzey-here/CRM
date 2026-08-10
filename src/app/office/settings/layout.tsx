'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isTenantAdmin, setIsTenantAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.app_metadata?.tenant_role === 'tenant_admin') {
        setIsTenantAdmin(true)
      }
    })
  }, [])

  const navItems = [
    { name: 'Inventory Catalog', href: '/office/settings/inventory' },
    { name: 'Branding', href: '/office/settings/branding' },
    { name: 'Pricing', href: '/office/settings/pricing' },
    { name: 'Invoice Template', href: '/office/settings/invoice-template' },
    ...(isTenantAdmin ? [{ name: 'Staff', href: '/office/settings/staff' }] : []),
    ...(isTenantAdmin ? [{ name: 'Billing', href: '/office/settings/billing' }] : []),
    ...(isTenantAdmin ? [{ name: 'Mailboxes', href: '/office/settings/mailboxes' }] : []),
    ...(isTenantAdmin ? [{ name: 'AI Assistant', href: '/office/settings/ai-assistant' }] : []),
    ...(isTenantAdmin ? [{ name: 'Email Labels', href: '/office/settings/email-labels' }] : []),
    ...(isTenantAdmin ? [{ name: 'Web Widget', href: '/office/settings/web-widget' }] : []),
  ]

  return (
    <div className="mx-auto max-w-7xl lg:flex lg:gap-x-16 lg:px-8">
      <aside className="flex overflow-x-auto border-b border-slate-900/5 py-4 lg:block lg:w-64 lg:flex-none lg:border-0 lg:py-20">
        <nav className="flex-none px-4 sm:px-6 lg:px-0">
          <ul role="list" className="flex gap-x-3 gap-y-1 whitespace-nowrap lg:flex-col">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'bg-blue-50 text-[var(--color-primary)]'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-[var(--color-primary)]',
                      'group flex gap-x-3 rounded-md py-2 pl-2 pr-3 text-sm leading-6 font-semibold'
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <main className="px-4 py-16 sm:px-6 lg:flex-auto lg:px-0 lg:py-20">
        {children}
      </main>
    </div>
  )
}
