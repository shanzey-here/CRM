import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HeaderNav } from './components/header-nav'
import { RealtimeAlerts } from './components/realtime-alerts'

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // 1. Fetch User and enforce authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. Strict Role Guard
  // The `/office` route is strictly for tenant staff.
  const appMetadata = user.app_metadata || {}
  const role = (appMetadata.tenant_role ?? appMetadata.role) as string | undefined
  const tenantId = appMetadata.tenant_id

  if (!tenantId) {
    // If somehow a super_admin lands here or a malformed user, redirect out
    redirect('/login?error=no_tenant_context')
  }

  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    // Crew and Customers are forbidden from the office dashboard
    redirect('/login?error=unauthorized_role')
  }

  // 3. Layout Render
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/office/leads" className="text-xl font-bold text-emerald-600">Gomove</Link>
              </div>
              <HeaderNav />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-slate-500 mr-4">{user.email}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <RealtimeAlerts tenantId={tenantId} />
    </div>
  )
}
