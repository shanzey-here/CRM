import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const THREAD_ID = 'c48ab2ef-e564-42be-80b3-0f6e650a0353'

async function main() {
  console.log('--- Attempt 1: mailboxes!mailbox_id ( ... ) ---')
  const r1 = await supabase.from('email_threads').select('id, mailboxes!mailbox_id ( id, mailbox_address )').eq('id', THREAD_ID).single()
  console.log(JSON.stringify(r1))

  console.log('\n--- Attempt 2: plain mailboxes ( ... ) no alias ---')
  const r2 = await supabase.from('email_threads').select('id, mailboxes ( id, mailbox_address )').eq('id', THREAD_ID).single()
  console.log(JSON.stringify(r2))

  console.log('\n--- Attempt 3: mailbox:mailboxes ( ... ) alias:table ---')
  const r3 = await supabase.from('email_threads').select('id, mailbox:mailboxes ( id, mailbox_address )').eq('id', THREAD_ID).single()
  console.log(JSON.stringify(r3))
}

main()
