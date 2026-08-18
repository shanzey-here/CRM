import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { upsertContactPricingOverride } = await import('../../src/modules/clients/server/pricing-overrides')
  const { data: admin } = await supabase.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const { data, error } = await upsertContactPricingOverride(
    supabase as any,
    admin!.tenant_id,
    process.argv[2],
    { discount_percent: 15, notes: 'Corporate negotiated rate — integration test' },
    admin!.id
  )
  console.log(JSON.stringify(data, null, 2), error?.message)
}
main()
