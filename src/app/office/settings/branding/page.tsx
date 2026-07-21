import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTenantSettings } from '@/modules/settings/branding/server/repository'
import { BrandingForm } from './components/branding-form'

export const dynamic = 'force-dynamic'

export default async function BrandingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Log session info for JWT verification in browser console
  if (user) {
    console.log('[Branding] Current user session:', {
      email: user.email,
      userId: user.id,
      app_metadata: {
        tenant_id: user.app_metadata?.tenant_id,
        tenant_role: user.app_metadata?.tenant_role,
      },
    })
  }

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: settings, error } = await getTenantSettings(supabase, tenantId)

  if (error || !settings) {
    console.error('[Branding] Load error:', { error, settings })
    return <div>Failed to load branding settings: {error?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Branding Settings</h1>
      <p className="text-sm text-slate-500 mb-8">
        Customize your company's branding that appears on proposals and communications.
      </p>
      <BrandingForm settings={settings} />
    </div>
  )
}
