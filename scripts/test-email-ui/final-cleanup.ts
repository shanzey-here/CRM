import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Tenant B and everything under it (cascades)
  await supabase.from('tenants').delete().eq('id', 'd1f6697b-bd40-4545-8693-1455140c8a97')
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const userB = authUsers.users.find((u) => u.email === 'dispatcher-b-inbox@emailtest.local')
  if (userB) await supabase.auth.admin.deleteUser(userB.id)
  console.log('Deleted Tenant B and its dispatcher user')

  // Tenant A's test mailboxes (cascades to threads/messages via FK, deleted explicitly first to be safe)
  for (const mailboxId of ['aa0c9a72-ed9e-4aa0-8679-f6ea1041ce6f', 'd03e2c89-19f1-42ce-8518-4e09d46eb4fd']) {
    await supabase.from('email_messages').delete().eq('mailbox_id', mailboxId)
    await supabase.from('email_threads').delete().eq('mailbox_id', mailboxId)
    await supabase.from('mailboxes').delete().eq('id', mailboxId)
  }
  console.log('Deleted test mailboxes, threads, and messages')

  // The contact created during manual-association testing
  await supabase.from('contacts').delete().eq('email', 'saturday.mover@example-recipient.test')
  console.log('Deleted test contact')

  const { data: remainingMailboxes } = await supabase.from('mailboxes').select('id')
  console.log('\nRemaining mailboxes (should be empty or pre-existing only):', remainingMailboxes)
}

main()
