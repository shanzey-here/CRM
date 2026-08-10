import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WebWidgetSettingsClient } from './components/web-widget-settings-client'

export const metadata = {
  title: 'Web Widget Settings',
}

export default async function WebWidgetSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata.tenant_role !== 'tenant_admin') {
    redirect('/office')
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('public_widget_key')
    .eq('id', user.app_metadata.tenant_id)
    .single()

  if (!tenant) {
    return <div>Error loading tenant settings.</div>
  }

  // The origin is needed to build the full iframe URL. Since Server Components don't have window,
  // we'll pass a relative path or expect the client component to build the full absolute URL using window.location.origin
  
  return (
    <div className="max-w-4xl">
      <div>
        <h2 className="text-base font-semibold leading-7 text-gray-900">Web Widget</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Embed a lead capture form on your website. Visitors who fill out this form will automatically appear in your CRM as Clients (with a Web Widget source), ready to be converted into Leads.
        </p>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-6">
        <WebWidgetSettingsClient widgetKey={tenant.public_widget_key} />
      </div>
    </div>
  )
}
