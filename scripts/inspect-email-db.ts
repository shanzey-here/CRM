import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkDb() {
  const { data: tenants } = await supabase.from('tenants').select('id, name, created_at')
  console.log('Tenants:', tenants)
  
  const { data: mailboxes } = await supabase.from('mailboxes').select('id, tenant_id, mailbox_address, is_active, provider')
  console.log('Mailboxes count:', mailboxes?.length, mailboxes)

  const { data: threads } = await supabase.from('email_threads').select('id, tenant_id, subject, mailbox_id')
  console.log('Threads count:', threads?.length, threads?.slice(0, 5))
}

checkDb()
