import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const quoteId = 'a7744406-5c2a-49e3-85db-cb3adf1cc6e0'
  const crewUserId = '4b91ec16-a7b4-48b0-8ed2-479674e1a43e' // crew@devtest.local

  // 1. Seed quote_inventory referencing a real catalog item, frozen at CURRENT catalog values
  const { data: inv, error: invErr } = await sc.from('quote_inventory').insert({
    tenant_id: tenantId,
    quote_id: quoteId,
    inventory_item_id: '06bb4d3b-825e-412d-a8df-5788d7ba8508', // Sofa
    item_name: 'Sofa',
    room: 'living_room',
    quantity: 2,
    volume: 45,
  }).select().single()
  console.log('Seeded quote_inventory:', JSON.stringify(inv), invErr ? JSON.stringify(invErr) : '')

  // 2. Seed a crew assignment with scheduled vs actual DIFFERING
  const { data: crew, error: crewErr } = await sc.from('job_crew_assignments').insert({
    tenant_id: tenantId,
    job_id: jobId,
    user_id: crewUserId,
    assignment_role: 'lead_crew',
    scheduled_start: '2026-08-11T09:00:00+00:00',
    scheduled_end: '2026-08-11T13:00:00+00:00',
    actual_start: '2026-08-11T09:20:00+00:00', // started 20min late
    actual_end: '2026-08-11T14:10:00+00:00',   // finished 1h10 late
  }).select().single()
  console.log('Seeded crew assignment:', JSON.stringify(crew), crewErr ? JSON.stringify(crewErr) : '')

  // 3. Confirm job is not yet completed/signed
  const { data: job } = await sc.from('jobs').select('id, status, completion_summary').eq('id', jobId).single()
  console.log('Job state:', JSON.stringify(job))
}
main()
