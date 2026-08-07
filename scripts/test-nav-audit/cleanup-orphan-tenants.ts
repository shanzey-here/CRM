import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: authUser } = await sc.auth.admin.listUsers()
  const target = authUser.users.find(u => u.email === 'admin-freetier@workflowtest.local')
  console.log('Existing auth user:', JSON.stringify(target ? { id: target.id, email: target.email, app_metadata: target.app_metadata } : null))

  const { data: userRow } = await sc.from('users').select('*').eq('email', 'admin-freetier@workflowtest.local').maybeSingle()
  console.log('Existing users row:', JSON.stringify(userRow))

  for (const tid of ['b181c2ad-20c5-4275-97fb-f6a5789e7bd5', '28f0b238-49be-4938-9f5c-20cc36c83986']) {
    const { data: t } = await sc.from('tenants').select('*').eq('id', tid).maybeSingle()
    console.log('Tenant', tid, ':', JSON.stringify(t))
  }
}
main()
