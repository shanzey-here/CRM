import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const OVERDUE_CRATE_ID = 'eb77ee36-e1e3-4446-b22d-307522797b4a'

async function main() {
  const today = new Date().toISOString().slice(0, 10)

  // Simulate "this crate's overdue charge for today has already been
  // claimed" (either mid-flight from a concurrent sweep, or already
  // successfully charged) by flipping one of today's real rows to
  // 'pending' — the exact state a real successful destination charge
  // would have left it in (this is the ONLY thing Connect being disabled
  // prevents us from producing live; the guard mechanism itself doesn't
  // care how the row got there).
  const { data: existing } = await supabase.from('crate_charges').select('id').eq('crate_id', OVERDUE_CRATE_ID).eq('period_start', today).eq('status', 'failed').limit(1).single()

  await supabase.from('crate_charges').update({ status: 'pending', error: null }).eq('id', existing!.id)
  console.log('Seeded row', existing!.id, 'as pending for period', today)

  const { count: before } = await supabase.from('crate_charges').select('id', { count: 'exact', head: true }).eq('crate_id', OVERDUE_CRATE_ID).eq('period_start', today)
  console.log('Rows for this crate/period BEFORE sweep:', before)

  const { sweepCrateBilling } = await import('../../src/modules/storage/server/billing')
  const result = await sweepCrateBilling(supabase as any)
  const thisCrateResult = result.results.find((r) => r.crateId === OVERDUE_CRATE_ID)
  console.log('\nSweep result for this crate:', JSON.stringify(thisCrateResult))

  const { count: after } = await supabase.from('crate_charges').select('id', { count: 'exact', head: true }).eq('crate_id', OVERDUE_CRATE_ID).eq('period_start', today)
  console.log('Rows for this crate/period AFTER sweep (must be unchanged, same as before):', after)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
