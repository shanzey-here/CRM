import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: all } = await sc.from('job_vehicle_assignments').select('*')
  console.log('ALL vehicle assignments in DB:', JSON.stringify(all, null, 2))
}
main()
