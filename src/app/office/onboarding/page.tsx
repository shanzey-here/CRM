import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WizardClient } from './components/wizard-client'
import { getTenantSettings } from '@/modules/settings/branding/server/repository'
import { getPricingSettings } from '@/modules/settings/pricing/server/repository'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || user.app_metadata.tenant_role !== 'tenant_admin') {
    redirect('/office')
  }

  const tenantId = user.app_metadata.tenant_id

  // Check current state. If not pending, boot them out.
  // Wait, if they are pending, we show the wizard. 
  // We need to fetch tenant_settings natively to read onboarding_state, 
  // but getTenantSettings already does this.
  const { data: tenantSettings } = await getTenantSettings(supabase, tenantId)
  
  // Strict guard: only 'pending' allowed here.
  if (tenantSettings?.onboarding_state !== 'pending') {
    redirect('/office')
  }

  const { data: pricingSettings } = await getPricingSettings(supabase, tenantId)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-800 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to your new workspace</h1>
          <p className="text-slate-400">Let's get your branding, rates, and catalog set up so you can start quoting.</p>
        </div>
        
        <WizardClient 
          initialBranding={tenantSettings} 
          initialPricing={pricingSettings} 
        />
      </div>
    </div>
  )
}
