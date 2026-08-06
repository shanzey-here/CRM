import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const itemId = '06bb4d3b-825e-412d-a8df-5788d7ba8508'
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'

  console.log('=== BEFORE catalog edit ===')
  const { data: beforeSummary } = await sc.from('jobs').select('completion_summary').eq('id', jobId).single()
  console.log('Completion summary inventory:', JSON.stringify((beforeSummary?.completion_summary as any)?.inventory))

  const { data: beforeItem } = await sc.from('inventory_items').select('*').eq('id', itemId).single()
  console.log('Catalog item before:', JSON.stringify(beforeItem))

  console.log('\n=== Editing the catalog item (name + volume) ===')
  const { data: updated, error } = await sc
    .from('inventory_items')
    .update({ name: 'Sofa RENAMED-DRIFT-TEST', default_volume: 999 })
    .eq('id', itemId)
    .select()
    .single()
  console.log('Catalog item after edit:', JSON.stringify(updated), error ? JSON.stringify(error) : '')

  console.log('\n=== AFTER catalog edit — re-checking the job completion summary (should be UNCHANGED) ===')
  const { data: afterSummary } = await sc.from('jobs').select('completion_summary').eq('id', jobId).single()
  console.log('Completion summary inventory:', JSON.stringify((afterSummary?.completion_summary as any)?.inventory))

  const unchanged = JSON.stringify(beforeSummary?.completion_summary) === JSON.stringify(afterSummary?.completion_summary)
  console.log('\ncompletion_summary is byte-for-byte IDENTICAL before/after catalog edit:', unchanged)
}
main()
