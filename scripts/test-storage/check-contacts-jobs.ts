import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: contacts } = await supabase.from('contacts').select('id, first_name, last_name').eq('tenant_id', tenantId).limit(5)
  console.log('Contacts:', JSON.stringify(contacts, null, 2))

  const { data: jobs } = await supabase.from('jobs').select('id, status, move_date, contact_id, contacts(first_name,last_name)').eq('tenant_id', tenantId).limit(5)
  console.log('Jobs:', JSON.stringify(jobs, null, 2))
}
main()
