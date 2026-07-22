import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAvailablePlans, getTenantSubscription } from '@/modules/subscriptions/server/repository'
import { BillingPanel } from './components/billing-panel'

export const dynamic = 'force-dynamic'

export default async function BillingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const [subscription, plans] = await Promise.all([
    getTenantSubscription(supabase, tenantId),
    getAvailablePlans(supabase),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Billing</h1>
      <p className="text-sm text-slate-500 mb-8">
        Manage your subscription. Payment methods, invoices, and plan changes are handled through
        Stripe's secure Customer Portal.
      </p>
      <BillingPanel subscription={subscription} plans={plans as any} />
    </div>
  )
}
