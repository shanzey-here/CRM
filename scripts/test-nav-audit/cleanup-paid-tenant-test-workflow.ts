import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('automation_workflows').select('id').eq('name', 'Paid tenant regression test workflow').single()
  if (data) {
    await sc.from('automation_workflow_actions').delete().eq('workflow_id', data.id)
    await sc.from('automation_workflows').delete().eq('id', data.id)
    console.log('Cleaned up dev tenant test workflow:', data.id)
  }
}
main()
