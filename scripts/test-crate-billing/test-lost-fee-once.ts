import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const LOST_CRATE_ID = '5ba80ddf-d132-4e4a-88c5-bdb6700aa3ce'

async function main() {
  // Simulate "this crate's lost fee has already been successfully
  // charged" — flip today's failed attempt (from the earlier real sweep
  // runs) to 'pending'.
  const { data: existing } = await supabase.from('crate_charges').select('id, period_start').eq('crate_id', LOST_CRATE_ID).eq('status', 'failed').order('created_at', { ascending: false }).limit(1).single()
  await supabase.from('crate_charges').update({ status: 'pending', error: null }).eq('id', existing!.id)
  console.log('Seeded lost_fee row', existing!.id, 'period_start:', existing!.period_start, 'as pending')

  const { count: before } = await supabase.from('crate_charges').select('id', { count: 'exact', head: true }).eq('crate_id', LOST_CRATE_ID).eq('charge_type', 'lost_fee')
  console.log('lost_fee rows BEFORE sweep:', before)

  const { sweepCrateBilling } = await import('../../src/modules/storage/server/billing')

  // Run the sweep TWICE, simulating two separate days (a lost crate stays
  // 'lost' forever — a real sweep would hit it again tomorrow, and the day
  // after). The lost_fee guarantee has to hold regardless of how many
  // times or which day it's swept, not just "not the same day twice".
  const run1 = await sweepCrateBilling(supabase as any)
  const run2 = await sweepCrateBilling(supabase as any)

  const r1 = run1.results.find((r) => r.crateId === LOST_CRATE_ID)
  const r2 = run2.results.find((r) => r.crateId === LOST_CRATE_ID)
  console.log('\nSweep run 1 result for lost crate:', JSON.stringify(r1))
  console.log('Sweep run 2 result for lost crate:', JSON.stringify(r2))

  const { count: after } = await supabase.from('crate_charges').select('id', { count: 'exact', head: true }).eq('crate_id', LOST_CRATE_ID).eq('charge_type', 'lost_fee')
  console.log('\nlost_fee rows AFTER both sweeps (must be unchanged, same as before):', after)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
