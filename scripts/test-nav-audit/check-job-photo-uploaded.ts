import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('job_photos').select('*').eq('job_id', '204844af-ad55-4d73-b91c-2188e0e587c6').order('created_at', { ascending: false }).limit(3)
  console.log('Real job_photos rows:', JSON.stringify(data, null, 2))
}
main()
