import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  // Query threads using admin client to see all 53 threads
  const { data: threads, error } = await admin
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
       contacts ( id, first_name, last_name, email ),
       leads ( id, stage, contact_id, contacts ( first_name, last_name ) )`
    )
    .eq('tenant_id', TENANT_ID)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  console.log('Admin query threads count:', threads?.length, 'Error:', error?.message)
}

run()
