import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const MAILBOX_ID = '1dce5fc6-7f8b-4cc0-9b17-a84a5841473c'

  const { data: threads, count } = await supabase
    .from('email_threads')
    .select('*', { count: 'exact' })
    .eq('mailbox_id', MAILBOX_ID)
  console.log('Thread count for this mailbox (must be exactly 1):', count)
  console.log(JSON.stringify(threads, null, 2))

  const { data: messages } = await supabase
    .from('email_messages')
    .select('id, direction, from_address, source_message_id, occurred_at, thread_id, body_text')
    .eq('mailbox_id', MAILBOX_ID)
    .order('occurred_at', { ascending: true })
  console.log('\nMessages, ordered by occurred_at:')
  console.log(JSON.stringify(messages, null, 2))

  const distinctThreadIds = new Set(messages?.map((m) => m.thread_id))
  console.log('\nDistinct thread_ids across both messages (must be exactly 1 -> proves reply threaded correctly):', distinctThreadIds.size)
}

main()
