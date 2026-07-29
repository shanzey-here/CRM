import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Tenant:', tenantId)

  const { data: tenant } = await supabase.from('tenants').select('id, name, stripe_connected_account_id').eq('id', tenantId).single()
  console.log('Tenant Stripe connected account:', tenant?.stripe_connected_account_id)

  const { data: pricing } = await supabase.from('pricing_settings').select('*').eq('tenant_id', tenantId).single()
  console.log('Pricing settings:', JSON.stringify(pricing, null, 2))
}
main()
