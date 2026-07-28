import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Tenant B and everything under it (cascades)
  await supabase.from('tenants').delete().eq('id', '6a1f69e2-3aa4-41c9-b2b5-85f1084dc41e')
  console.log('Deleted Tenant B and cascaded rows')

  // Test mailboxes on Tenant A (cascades to their threads/messages)
  await supabase.from('mailboxes').delete().eq('id', '1dce5fc6-7f8b-4cc0-9b17-a84a5841473c') // healthy IMAP test
  await supabase.from('mailboxes').delete().eq('id', '0e7c9558-a064-4a63-b490-e845bdd54c9c') // broken IMAP test
  await supabase.from('mailboxes').delete().eq('id', '808d4ba3-e50f-46e6-a9be-2643f6ffae15') // stray leftover from email-db branch
  console.log('Deleted test mailboxes on Tenant A')

  // Any remaining email.received events from this test session
  const { error, count } = await supabase
    .from('domain_events')
    .delete({ count: 'exact' })
    .eq('event_type', 'email.received')
  console.log('Deleted email.received test events:', count, error?.message)
}

main()
