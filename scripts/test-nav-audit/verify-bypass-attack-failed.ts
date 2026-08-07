import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('automation_workflows').select('id, name, is_active').eq('tenant_id', 'b181c2ad-20c5-4275-97fb-f6a5789e7bd5')
  console.log('All workflows for free-tier tenant (should be exactly 1, the pre-existing seeded one, no attack workflow):', JSON.stringify(data))
}
main()
