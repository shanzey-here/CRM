import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function testQuery() {
  // Sign in as admin@devtest.local
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@devtest.local',
    password: 'password123',
  })
  console.log('Sign in:', auth.user?.id, authError?.message)

  // Test 1: Direct mailboxes select
  const { data: mb, error: mbErr } = await supabase
    .from('mailboxes')
    .select('id, mailbox_address, provider')
    .eq('tenant_id', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1')
  console.log('Direct mailboxes select:', mb, mbErr?.message)

  // Test 2: email_threads with mailboxes embed
  const { data: th1, error: th1Err } = await supabase
    .from('email_threads')
    .select(`
      id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
      contacts ( id, first_name, last_name, email ),
      leads ( id, stage, contact_id, contacts ( first_name, last_name ) ),
      mailboxes ( id, mailbox_address )
    `)
    .eq('tenant_id', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1')
  console.log('Threads with mailboxes embed:', th1?.length, th1Err?.message)

  // Test 3: email_threads WITHOUT mailboxes embed
  const { data: th2, error: th2Err } = await supabase
    .from('email_threads')
    .select(`
      id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
      contacts ( id, first_name, last_name ),
      leads ( contact_id, contacts ( first_name, last_name ) )
    `)
    .eq('tenant_id', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1')
  console.log('Threads WITHOUT mailboxes embed:', th2?.length, th2Err?.message)
}

testQuery()
