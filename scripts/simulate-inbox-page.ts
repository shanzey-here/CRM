import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function simulatePage() {
  const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  const [{ data: mailboxes }, { count: pendingDrafts }] = await Promise.all([
    admin.from('mailboxes').select('id, mailbox_address, provider, is_active, brand_id, brands(name)').eq('tenant_id', TENANT_ID),
    admin.from('email_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('authored_by', 'ai_draft_pending'),
  ])

  const { data: threads, error } = await admin
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
       contacts ( id, first_name, last_name, email ),
       leads ( id, stage, contact_id, contacts ( first_name, last_name ) )`
    )
    .eq('tenant_id', TENANT_ID)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  const { data: labels } = await admin.from('email_labels').select('*').eq('tenant_id', TENANT_ID)
  const { data: assignments } = await admin.from('email_label_assignments').select('*, email_labels(*)').eq('tenant_id', TENANT_ID)

  console.log('--- Page Data Simulation ---')
  console.log('Mailboxes Count:', mailboxes?.length)
  console.log('Pending Drafts Count:', pendingDrafts)
  console.log('Threads Count:', threads?.length, 'Error:', error?.message)
  console.log('Labels Count:', labels?.length)
  console.log('Assignments Count:', assignments?.length)
  console.log('Sample thread 1:', threads?.[0]?.subject)
}

simulatePage()
