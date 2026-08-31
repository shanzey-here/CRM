import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function check() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: user } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = user!.tenant_id!

  const { data: stages } = await supabase.from('pipeline_stages').select('id, key, name, is_system, is_hidden_by_default').eq('tenant_id', tenantId)
  console.log('Stages:', stages)

  const { data: jobs } = await supabase.from('jobs').select('id, quote_id, contact_id, status, move_date, quote:quotes(id, lead_id, total_price)').eq('tenant_id', tenantId)
  console.log('Jobs (Confirmed Bookings):', JSON.stringify(jobs, null, 2))

  const { data: leads } = await supabase.from('leads').select('id, stage, stage_id, contact:contacts(first_name, last_name)').eq('tenant_id', tenantId)
  console.log('Leads:', JSON.stringify(leads, null, 2))
}
check()
