import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function inspectTenant() {
  const { data: mailboxes } = await supabase.from('mailboxes').select('*').eq('tenant_id', TENANT_ID)
  console.log('Mailboxes for admin@devtest.local:', mailboxes)

  const { data: threads } = await supabase.from('email_threads').select('id, subject, mailbox_id').eq('tenant_id', TENANT_ID)
  console.log('Threads for admin@devtest.local:', threads?.length, threads?.slice(0, 5))

  const { data: assignments } = await supabase.from('email_label_assignments').select('*, email_labels(*)').eq('tenant_id', TENANT_ID)
  console.log('Label assignments for admin@devtest.local:', assignments)
}

inspectTenant()
