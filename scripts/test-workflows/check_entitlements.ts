import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const tenantId = 'db4700db-a5a8-4a52-b7d8-6ebef78195b7'
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .single()
  
  if (!tenant) {
    console.log('Tenant not found')
    return
  }

  console.log('Tenant:', tenant)

  const { data: sub } = await supabase
    .from('tenant_subscriptions')
    .select('saas_prices ( saas_plans ( name, entitlements ) )')
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  
  console.log('Subscription Entitlements:', JSON.stringify(sub, null, 2))

  const { data: tm } = await supabase
    .from('tenant_modules')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('module_key', 'automation_workflows')
    .maybeSingle()

  console.log('Tenant Module:', JSON.stringify(tm, null, 2))
}
run().catch(console.error)
