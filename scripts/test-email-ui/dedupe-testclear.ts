import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Keep the row with Gmail's real Message-ID, delete the one with our own
  // locally-generated id — this is the pre-existing duplicate caused by the
  // bug just fixed in send.ts/actions.ts.
  const { error } = await supabase
    .from('email_messages')
    .delete()
    .eq('source_message_id', '<f799f4cb-64fc-450a-85fc-8937dc2f2f5c@gmail.com>')

  console.log('delete error:', error)

  const { data } = await supabase
    .from('email_messages')
    .select('id, body_text, source_message_id, occurred_at')
    .eq('thread_id', '2a8948cf-ad13-49df-94bb-385d6d6c897c')
    .order('occurred_at', { ascending: true })
  console.log(JSON.stringify(data, null, 2))
}
main()
