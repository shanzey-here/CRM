import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { sweepDuePosts } from '../../src/modules/social/server/scheduler'

const POST_ID = '5be7d10b-3a36-493d-ae16-ddb3d73bdfc6' // the cancelled post from schedule-and-cancel.ts

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Force scheduled_for into the past — proves the sweep's exclusion of
  // this row is genuinely status-based ('cancelled' != 'pending'), not
  // just "hasn't reached its time yet."
  await supabase.from('scheduled_posts').update({ scheduled_for: new Date(Date.now() - 60000).toISOString() }).eq('id', POST_ID)

  const before = await supabase.from('scheduled_posts').select('status, claimed_at, scheduled_for').eq('id', POST_ID).single()
  console.log('Before sweep:', JSON.stringify(before.data))

  const result = await sweepDuePosts(supabase)
  console.log('Sweep result:', JSON.stringify(result))
  console.log('Cancelled post appears in sweep results?', result.results.some((r) => r.postId === POST_ID))

  const after = await supabase.from('scheduled_posts').select('status, claimed_at, publish_results').eq('id', POST_ID).single()
  console.log('After sweep (must be unchanged — still cancelled, never claimed):', JSON.stringify(after.data))
}
main()
