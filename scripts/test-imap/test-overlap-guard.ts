import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { runMailboxSync } = await import('../../src/modules/mailboxes/server/sync')

  // Fire two sync runs genuinely concurrently — the overlap guard must let
  // exactly one proceed and make the other exit immediately via the lock.
  console.log('Firing two concurrent sync runs...')
  const [resultA, resultB] = await Promise.all([runMailboxSync(supabase as any), runMailboxSync(supabase as any)])

  console.log('\nRun A result:', JSON.stringify(resultA))
  console.log('Run B result:', JSON.stringify(resultB))

  const skippedCount = [resultA, resultB].filter((r) => r.skipped).length
  const ranCount = [resultA, resultB].filter((r) => !r.skipped).length

  console.log('\nExactly one skipped, one ran?', skippedCount === 1 && ranCount === 1 ? 'YES (guard worked)' : 'NO - both ran or both skipped')

  // Confirm the lock was released after both completed (not stuck forever)
  const { data: lockState } = await supabase.from('mailbox_sync_lock').select('*').eq('id', true).single()
  console.log('\nLock state after both runs complete (is_running must be false):', lockState)
}

main()
