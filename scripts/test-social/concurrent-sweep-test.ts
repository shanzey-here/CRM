import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { sweepDuePosts } from '../../src/modules/social/server/scheduler'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Two genuinely concurrent invocations of the exact function the cron
  // route calls — Promise.all starts both before either awaits, so this
  // is a stricter concurrency test than two separate HTTP requests
  // (which are also subject to node/network scheduling, not just DB
  // locking).
  const [a, b] = await Promise.all([sweepDuePosts(supabase), sweepDuePosts(supabase)])
  console.log('Sweep A:', JSON.stringify(a))
  console.log('Sweep B:', JSON.stringify(b))
  console.log('Total processed across both concurrent calls:', a.processed + b.processed)
}
main()
