import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('--- Approved message (should now be ai_sent, edited body, real source_message_id) ---')
  const { data: approved } = await supabase
    .from('email_messages')
    .select('id, authored_by, requires_approval, body_text, sent_at, source_message_id')
    .eq('id', 'cf37cf0b-5c03-4341-a157-88135b29633f')
    .single()
  console.log(JSON.stringify(approved, null, 2))

  console.log('\n--- Discarded message (should no longer exist) ---')
  const { data: discarded, error } = await supabase
    .from('email_messages')
    .select('id')
    .eq('id', '295818da-f317-4c75-90b9-0b76e631a259')
    .maybeSingle()
  console.log('row:', discarded, 'error:', error)
}
main()
