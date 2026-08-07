import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const { data: template, error } = await sc.from('invoice_templates').select('*').eq('tenant_id', admin!.tenant_id).single()
  console.log('Template row:', JSON.stringify(template, null, 2))
  console.log('Error:', error?.message)
}
main()
