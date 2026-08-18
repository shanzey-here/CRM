import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await sc.rpc('exec_sql', { query: "SELECT enum_range(NULL::activity_type)" })
  console.log('exec_sql rpc result:', JSON.stringify(data), error ? JSON.stringify(error) : '(no error)')
}
main()
