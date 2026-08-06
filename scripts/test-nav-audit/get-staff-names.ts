import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const { data } = await sc.from('users').select('id, email, full_name, role, is_active').eq('tenant_id', admin!.tenant_id).in('role', ['tenant_admin','dispatcher','crew'])
  console.log(JSON.stringify(data, null, 2))
}
main()
