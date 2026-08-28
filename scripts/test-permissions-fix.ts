import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function testFix() {
  const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  // 1. Fetch mailboxes via service client
  const { data: mailboxes, error: mbErr } = await admin
    .from('mailboxes')
    .select('id, mailbox_address, provider, is_active, brand_id, brands(name)')
    .eq('tenant_id', TENANT_ID)

  console.log('Mailboxes fetched via service client:', mailboxes?.length, mbErr?.message)

  // 2. Fetch threads WITHOUT embedded mailboxes
  const { data: threads, error: thErr } = await admin
    .from('email_threads')
    .select(`
      id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
      contacts ( id, first_name, last_name, email ),
      leads ( id, stage, contact_id, contacts ( first_name, last_name ) )
    `)
    .eq('tenant_id', TENANT_ID)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  console.log('Threads fetched:', threads?.length, thErr?.message)
}

testFix()
