import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: contact } = await supabase.from('contacts').select('id, first_name, last_name').eq('tenant_id', tenantId).eq('first_name', 'Alice').single()

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({ tenant_id: tenantId, contact_id: contact!.id, status: 'scheduled', move_date: '2026-08-15' })
    .select()
    .single()

  console.log('error:', error)
  console.log('Fixture job:', JSON.stringify(job))
}
main()
