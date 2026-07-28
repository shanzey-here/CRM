import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPricingSettings } from '@/modules/settings/pricing/server/repository'
import { PricingForm } from './components/pricing-form'

export const dynamic = 'force-dynamic'

export default async function PricingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: settings, error } = await getPricingSettings(supabase, tenantId)

  if (error || !settings) {
    console.error('[Pricing] Load error:', { error, settings })
    return <div>Failed to load pricing settings: {error?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Pricing Settings</h1>
      <p className="text-sm text-slate-500 mb-8">
        Configure your base rates, hourly labor costs, and surcharges. These rates are used when
        generating quotes.
      </p>
      <PricingForm settings={settings} />
    </div>
  )
}
