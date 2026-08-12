import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SidebarNav } from './components/header-nav'
import { NotificationBell } from './components/notification-bell'
import { AnnouncementBannerStack } from './components/announcement-banner-stack'
import { getActiveAnnouncementsForTenant } from '@/modules/announcements/server/repository'
import { isPastDueAccessExpired } from '@/modules/subscriptions/server/grace-period'

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
  // Set by src/lib/supabase/middleware.ts (proxy) on every request — layouts
  // have no built-in access to the current pathname (Next.js's own docs:
  // "Layouts do not re-render on navigation, so they do not access
  // pathname"), so it's forwarded as a header instead.
  const currentPath = headersList.get('x-pathname') || ''
  
  const { getTenantSubscription } = await import('@/modules/subscriptions/server/repository')
  const subscription = await getTenantSubscription(supabase, tenantId)
  const subStatus = subscription?.status ?? 'active'

  const isBillingPage = currentPath.startsWith('/office/settings/billing')

  // past_due gets a 7-day grace period (isPastDueAccessExpired), unlike
  // cancelled/suspended/manually_suspended which block immediately — reuses
  // this exact same redirect, same billing-page exemption, not a second check.
  if (
    !isBillingPage &&
    (subStatus === 'cancelled' ||
      subStatus === 'suspended' ||
      subscription?.manually_suspended ||
      isPastDueAccessExpired(subscription?.past_due_since ?? null))
  ) {
    redirect('/office/settings/billing?restricted=true')
  }

  // 4. Banner Logic
  let trialDaysRemaining = null
  if (subStatus === 'trialing' && subscription?.current_period_end) {
    const { differenceInDays } = await import('date-fns')
    const { TRIAL_WARNING_DAYS } = await import('@/modules/subscriptions/server/trial-sweep')
    const days = differenceInDays(new Date(subscription.current_period_end), new Date())
    if (days >= 0 && days <= TRIAL_WARNING_DAYS) {
      trialDaysRemaining = days
    }
  }

  // Platform announcements are tenant_admin-only — the query itself is gated
  // by role, not just the JSX below. dispatcher never calls this.
  const planId = subscription?.saas_prices?.saas_plans?.id ?? null
  const activeAnnouncements =
    role === 'tenant_admin'
      ? await getActiveAnnouncementsForTenant(supabase, { tenantId, planId, userId: user.id })
      : []

  // 5. Layout Render
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar (Fixed) */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-50">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
          <Link href="/office" className="text-xl font-bold text-emerald-600">Gomove</Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <SidebarNav role={role} />
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="text-sm font-medium text-slate-900 truncate" title={user.email}>{user.email}</div>
          <form action="/auth/signout" method="POST" className="mt-2">
            <button type="submit" className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors">Log Out</button>
          </form>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Global Banners */}
        {role === 'tenant_admin' && activeAnnouncements.length > 0 && (
          <AnnouncementBannerStack
            initial={activeAnnouncements}
            tenantId={tenantId}
            planId={planId}
            userId={user.id}
          />
        )}
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

        {/* Minimal Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-200 flex items-center justify-end px-8 sticky top-0 z-40 shrink-0">
          <NotificationBell userId={user.id} />
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
