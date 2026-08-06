import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('jobs').select('completion_summary').eq('id', '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264').single()
  console.log(JSON.stringify(data?.completion_summary, null, 2))
}
main()
