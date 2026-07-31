import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInvoiceTemplate } from '@/modules/settings/invoice-template/server/repository'
import { getTenantSettings } from '@/modules/settings/branding/server/repository'
import { TemplateEditor } from './components/template-editor'

export const dynamic = 'force-dynamic'

export default async function InvoiceTemplateSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const [{ data: template, error: templateError }, { data: tenantSettings, error: settingsError }] = await Promise.all([
    getInvoiceTemplate(supabase, tenantId),
    getTenantSettings(supabase, tenantId),
  ])

  if (templateError || !template || settingsError || !tenantSettings) {
    console.error('[InvoiceTemplate] Load error:', { templateError, settingsError })
    return <div>Failed to load invoice template: {templateError?.message || settingsError?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Invoice Template</h1>
      <p className="text-sm text-slate-500 mb-8">
        Arrange how your invoices are laid out. This only changes presentation — real figures are
        always pulled live from each invoice when it's viewed, never stored here.
      </p>
      <TemplateEditor template={template} tenantSettings={tenantSettings} />
    </div>
  )
}
