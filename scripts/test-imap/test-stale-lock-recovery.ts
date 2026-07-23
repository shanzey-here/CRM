import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Simulate a crashed run: locked 20 minutes ago (past the 15-minute
  // staleness threshold), never released.
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  await supabase.from('mailbox_sync_lock').update({ is_running: true, started_at: twentyMinutesAgo }).eq('id', true)
  console.log('Simulated a stale lock from a "crashed" run 20 minutes ago')

  const { runMailboxSync } = await import('../../src/modules/mailboxes/server/sync')
  const result = await runMailboxSync(supabase as any)

  console.log('\nNew run result (must NOT be skipped — stale lock should be recovered):')
  console.log(JSON.stringify(result, null, 2))
}

main()
