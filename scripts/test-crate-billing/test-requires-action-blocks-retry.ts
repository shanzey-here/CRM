import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: contact } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).eq('first_name', 'CrateBilling').single()
  const { data: crate } = await supabase.from('crates').select('id').eq('tenant_id', tenantId).ilike('crate_number', 'BILLING-TEST-OVERDUE-%').single()

  const { markCrateChargeStatus } = await import('../../src/modules/storage/server/billing')

  // Create a real pending charge for a fresh test period, then apply the
  // real classification exactly as chargeOneCrate's catch block would.
  const rpc = await supabase.rpc('create_crate_charge_invoice', {
    p_tenant_id: tenantId,
    p_crate_id: crate!.id,
    p_contact_id: contact!.id,
    p_charge_type: 'overdue_fee',
    p_period_start: '2088-06-15',
    p_amount: 5,
    p_description: 'SCA classification storage test',
  })
  const chargeId = (rpc.data as any).crate_charge_id
  await markCrateChargeStatus(supabase as any, tenantId, chargeId, 'requires_action', 'Your card was declined. This transaction requires authentication.')

  const { data: stored } = await supabase.from('crate_charges').select('*').eq('id', chargeId).single()
  console.log('Stored charge:', JSON.stringify(stored, null, 2))
  console.log('\nStatus is requires_action, not failed?', stored?.status === 'requires_action')

  // Now attempt a SECOND charge for the SAME period — must be blocked,
  // same as a 'charged'/'pending' row would be (unlike 'failed').
  const rpc2 = await supabase.rpc('create_crate_charge_invoice', {
    p_tenant_id: tenantId,
    p_crate_id: crate!.id,
    p_contact_id: contact!.id,
    p_charge_type: 'overdue_fee',
    p_period_start: '2088-06-15',
    p_amount: 5,
    p_description: 'Retry attempt for the same period',
  })
  console.log('\nRetry attempt for the same period (must be already_charged:true — an SCA block does not get same-period retries):', JSON.stringify(rpc2.data))
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
