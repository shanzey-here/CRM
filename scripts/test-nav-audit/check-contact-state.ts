import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('contacts').select('id, preferred_contact_method, best_time_to_call').eq('id', '4368dff5-ef67-4e55-a454-50c9002d6960').single()
  console.log(JSON.stringify(data))
}
main()
