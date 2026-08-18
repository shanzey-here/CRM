import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { error } = await sc.from('job_vehicle_assignments').delete().eq('id', '572fc9b2-1ad4-4f5d-8438-ad2dd812d120')
  console.log('Cleaned up test vehicle assignment:', error?.message || 'ok')
}
main()
