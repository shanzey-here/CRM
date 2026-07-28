import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Clean up the stray manual test event from debugging
  await supabase.from('domain_events').delete().eq('event_type', 'email.received').contains('payload', { test: true })

  const { data: events } = await supabase
    .from('domain_events')
    .select('*')
    .eq('event_type', 'email.received')
    .order('occurred_at', { ascending: false })
    .limit(5)
  console.log('email.received domain events:')
  console.log(JSON.stringify(events, null, 2))
}

main()
