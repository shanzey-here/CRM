import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: adminUser } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = adminUser!.tenant_id

  const { data, error } = await supabase
    .from('connected_social_accounts')
    .insert({ tenant_id: tenantId, platform: 'facebook', aggregator_profile_id: 'deliberately_invalid_zernio_account_id_xyz', display_name: 'Broken Test Account (UI)', is_active: true })
    .select('id')
    .single()
  if (error) throw error
  console.log('Broken account row:', data.id)
}
main()
