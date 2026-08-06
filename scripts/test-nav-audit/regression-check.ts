import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  // Set a source on our test lead so we can check it renders
  await sc.from('leads').update({ source: 'referral' }).eq('id', 'd292cd7a-576c-417c-8dee-9350bff59e67')
  console.log('Set source=referral on test lead for regression check')
}
main()
