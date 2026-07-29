import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: before } = await supabase.from('tenants').select('stripe_connected_account_id').eq('id', tenantId).single()
  console.log('Previous stripe_connected_account_id:', before?.stripe_connected_account_id)

  const { data: updated, error } = await supabase
    .from('tenants')
    .update({ stripe_connected_account_id: 'acct_1TyMT1JnACsbptOm' })
    .eq('id', tenantId)
    .select('id, stripe_connected_account_id')
    .single()

  console.log('Updated:', JSON.stringify(updated), error?.message)
}
main()
