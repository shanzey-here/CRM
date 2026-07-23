import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const THREAD_ID = 'c48ab2ef-e564-42be-80b3-0f6e650a0353'

async function main() {
  const { data: messages } = await supabase
    .from('email_messages')
    .select('id, direction, from_address, to_addresses, body_text, authored_by, source_message_id, occurred_at')
    .eq('thread_id', THREAD_ID)
    .order('occurred_at', { ascending: true })

  console.log('Thread messages after real send:')
  console.log(JSON.stringify(messages, null, 2))

  const { data: thread } = await supabase.from('email_threads').select('last_message_at').eq('id', THREAD_ID).single()
  console.log('\nThread last_message_at updated:', thread)
}

main()
