import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const { data: users } = await supabase.from('users').select('email, role, tenant_id').eq('tenant_id', admin!.tenant_id)
  console.log(JSON.stringify(users, null, 2))
}
main()
