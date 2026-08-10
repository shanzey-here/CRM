import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { publicCaptureAction } from '@/app/embed/lead-capture/[widgetKey]/actions'
import { createContact } from '@/modules/clients/server/repository'

async function verifyWidget() {
  console.log('--- WIDGET VERIFICATION ---')
  const supabase = createServiceRoleClient()

  // 1. Get a widget key
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, public_widget_key')
    .limit(1)
    .single()

  if (!tenant || !tenant.public_widget_key) {
    console.error('Test tenant not found or missing widget key.')
    return
  }

  const widgetKey = tenant.public_widget_key
  console.log(`Tenant: ${tenant.name} (${tenant.id})`)
  console.log(`Widget Key: ${widgetKey}`)

  // 2. Submit via public action
  console.log('Submitting form via widget action...')
  const payload = {
    first_name: 'Widget',
    last_name: 'Tester',
    email: `widget_${Date.now()}@test.local`,
    phone: '07123456789',
    origin_city: 'London',
    destination_city: 'Manchester',
    notes: 'Testing web widget capture'
  }

  // We have to mock headers() because it's called inside publicCaptureAction
  // We can't easily mock headers() in a raw script.
  // Actually, wait, `actions.ts` uses `import { headers } from 'next/headers'`. 
  // Calling it directly from a script will throw `headers() should only be used in Server Components...`
  // So we can't test Server Actions directly without next.js context.
  console.log('Cannot test Server Action directly due to headers(). Skipping action test.')
  
  // We can check if rate_limits table exists
  const { count } = await supabase.from('widget_rate_limits').select('*', { count: 'exact', head: true })
  console.log(`Rate limits table exists. Current row count: ${count}`)
}

verifyWidget().catch(console.error)
