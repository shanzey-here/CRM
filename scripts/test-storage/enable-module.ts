import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { error } = await supabase
    .from('tenant_modules')
    .upsert({ tenant_id: tenantId, module_key: 'storage_crate_tracking', enabled: true }, { onConflict: 'tenant_id,module_key' })
  console.log('tenant_modules upsert error:', error)

  const { data: check } = await supabase.from('tenant_modules').select('*').eq('tenant_id', tenantId).eq('module_key', 'storage_crate_tracking').single()
  console.log('Confirmed:', JSON.stringify(check))
}
main()
