import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  console.log('tenant:', admin?.tenant_id)
  const { data: settings, error } = await supabase.from('tenant_settings').select('*').eq('tenant_id', admin!.tenant_id).maybeSingle()
  console.log('settings:', JSON.stringify(settings), error)
}
main()
