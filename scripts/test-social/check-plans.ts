import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: plans } = await supabase.from('saas_plans').select('id, name, entitlements')
  console.log('plans:', JSON.stringify(plans, null, 2))

  const { data: admin } = await supabase.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const { data: sub, error } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', admin!.tenant_id).maybeSingle()
  console.log('tenant subscription:', JSON.stringify(sub, null, 2), error)
}
main()
