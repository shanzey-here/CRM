import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTenantSettings } from '@/modules/settings/branding/server/repository'
import { getDefaultBrandId, getBrandById } from '@/modules/settings/brands/server/repository'
import { BrandingForm } from './components/branding-form'

export const dynamic = 'force-dynamic'

export default async function BrandingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const defaultBrandId = await getDefaultBrandId(supabase, tenantId)
  if (!defaultBrandId) {
    return <div>No default brand found for this tenant.</div>
  }

  const [{ data: brand, error: brandError }, { data: settings, error: settingsError }] = await Promise.all([
    getBrandById(supabase, tenantId, defaultBrandId),
    getTenantSettings(supabase, tenantId),
  ])

  if (brandError || !brand || settingsError || !settings) {
    console.error('[Branding] Load error:', { brandError, settingsError })
    return <div>Failed to load branding settings: {brandError?.message || settingsError?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Branding Settings</h1>
      <p className="text-sm text-slate-500 mb-8">
        This edits your <strong>default brand</strong>'s identity — the same real data shown on{' '}
        <Link href="/office/settings/brands" className="text-emerald-600 hover:underline">
          Brands
        </Link>
        , used on your invoices and proposals. If you run more than one business, manage the others there.
      </p>
      <BrandingForm brand={brand} primaryColor={settings.primary_color || '#1a56db'} />
    </div>
  )
}
