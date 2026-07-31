import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Dev tenant:', tenantId)

  const { data: customerUser } = await supabase.from('users').select('id, email, tenant_id').eq('email', 'customer@devtest.local').single()
  console.log('customer@devtest.local user row:', JSON.stringify(customerUser))

  const { data: contact } = await supabase.from('contacts').select('*').eq('tenant_id', tenantId).eq('user_id', customerUser!.id).maybeSingle()
  console.log('Linked contact:', JSON.stringify(contact, null, 2))

  const { data: tenantSettings } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).single()
  console.log('\nTenant settings (branding):', JSON.stringify(tenantSettings, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
