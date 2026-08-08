import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: users } = await sc.from('users').select('*').eq('tenant_id', 'b181c2ad-20c5-4275-97fb-f6a5789e7bd5')
  console.log('Users:', JSON.stringify(users, null, 2))
}
main()
