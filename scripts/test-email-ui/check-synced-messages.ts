import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: threads, error: threadsError } = await supabase
    .from('email_threads')
    .select('id, subject, mailbox_id, created_at')
    .eq('mailbox_id', '37a0090f-9996-4fee-b513-b0e9fdd9180b')

  console.log('threads error:', threadsError)
  console.log('threads:', JSON.stringify(threads, null, 2))

  const { data: messages, error: messagesError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('mailbox_id', '37a0090f-9996-4fee-b513-b0e9fdd9180b')

  console.log('\nmessages error:', messagesError)
  console.log('messages:', JSON.stringify(messages, null, 2))
}
main()
