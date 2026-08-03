import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HeaderNav } from './components/header-nav'
import { NotificationBell } from './components/notification-bell'

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

  // 3. Subscription Status Gating
  // We explicitly exempt /office/settings/billing from the hard block so they
  // can fix their suspended/cancelled account. (Note: server actions don't run
  // through layout.tsx, but UI navigation does).
  // Also, super_admin is already redirected out (they don't see /office), so
  // this is safely scoped to tenant staff.
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const currentPath = headersList.get('x-invoke-path') || ''
  
  const { getTenantSubscription } = await import('@/modules/subscriptions/server/repository')
  const subscription = await getTenantSubscription(supabase, tenantId)
  const subStatus = subscription?.status ?? 'active'

  const isBillingPage = currentPath.startsWith('/office/settings/billing')

  if (!isBillingPage && (subStatus === 'cancelled' || subStatus === 'suspended' || subscription?.manually_suspended)) {
    redirect('/office/settings/billing?restricted=true')
  }

  // 4. Banner Logic
  let trialDaysRemaining = null
  if (subStatus === 'trialing' && subscription?.current_period_end) {
    const { differenceInDays } = await import('date-fns')
    const days = differenceInDays(new Date(subscription.current_period_end), new Date())
    if (days >= 0 && days <= 3) {
      trialDaysRemaining = days
    }
  }

  // 5. Layout Render
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {subStatus === 'past_due' && (
        <div className="bg-amber-600 px-4 py-3 text-white text-sm font-medium text-center shadow-inner">
          Your last payment failed. Please update your billing information to avoid service interruption.{' '}
          <Link href="/office/settings/billing" className="underline hover:text-amber-100">
            Manage Billing
          </Link>
        </div>
      )}
      {trialDaysRemaining !== null && (
        <div className="bg-amber-500 px-4 py-3 text-amber-950 text-sm font-medium text-center shadow-inner">
          Your free trial expires in {trialDaysRemaining === 0 ? 'less than a day' : `${trialDaysRemaining} days`}. Please update your billing information to avoid service interruption.{' '}
          <Link href="/office/settings/billing" className="underline hover:text-amber-950 font-bold">
            Manage Billing
          </Link>
        </div>
      )}
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
              <NotificationBell userId={user.id} />
              <span className="text-sm text-slate-500 mr-4 ml-4">{user.email}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
