import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('automation_workflows').select('id, name, tenant_id').eq('name', 'Paid tenant regression test workflow').single()
  console.log('Dev tenant workflow:', JSON.stringify(data))
}
main()
