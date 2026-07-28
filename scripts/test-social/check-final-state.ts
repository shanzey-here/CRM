import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: mod } = await supabase.from('tenant_modules').select('*').eq('tenant_id', tenantId).eq('module_key', 'social_media').single()
  console.log('tenant_modules (social_media):', JSON.stringify(mod))

  const { data: accounts } = await supabase.from('connected_social_accounts').select('id, display_name, is_active').eq('tenant_id', tenantId)
  console.log('connected_social_accounts:', JSON.stringify(accounts, null, 2))
}
main()
