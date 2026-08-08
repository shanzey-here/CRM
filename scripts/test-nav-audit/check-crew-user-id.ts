import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: crewUser } = await sc.from('users').select('*').eq('email', 'crew@devtest.local').single()
  console.log('crew@devtest.local user id:', crewUser?.id)
  console.log('Matches job assignment user_id (4b91ec16...):', crewUser?.id === '4b91ec16-a7b4-48b0-8ed2-479674e1a43e')
}
main()
