import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: messages, error } = await supabase
    .from('email_messages')
    .select('id, direction, from_address, to_addresses, body_text, occurred_at, source_message_id, authored_by')
    .eq('thread_id', '2a8948cf-ad13-49df-94bb-385d6d6c897c')
    .order('occurred_at', { ascending: true })

  console.log('error:', error)
  for (const m of messages ?? []) {
    console.log(`[${m.occurred_at}] ${m.direction} from=${m.from_address} authored_by=${m.authored_by}`)
    console.log(`  body: ${JSON.stringify((m.body_text || '').slice(0, 80))}`)
    console.log(`  source_message_id: ${m.source_message_id}`)
  }
}
main()
