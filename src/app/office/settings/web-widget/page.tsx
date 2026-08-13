import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBrands } from '@/modules/settings/brands/server/repository'
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

  const { data: brands, error } = await getBrands(supabase, user.app_metadata.tenant_id)

  if (error || !brands || brands.length === 0) {
    return <div>Error loading brands.</div>
  }

  return (
    <div className="max-w-4xl">
      <div>
        <h2 className="text-base font-semibold leading-7 text-gray-900">Web Widget</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Embed a lead capture form on your website. Visitors who fill out this form will automatically appear in your CRM as Clients (with a Web Widget source), ready to be converted into Leads.
          {brands.length > 1 && ' Each brand below has its own snippet — a lead captured through a brand\'s form is automatically tagged with that brand.'}
        </p>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-6">
        <WebWidgetSettingsClient brands={brands.map((b) => ({ id: b.id, name: b.name, widgetKey: b.public_widget_key }))} />
      </div>
    </div>
  )
}
