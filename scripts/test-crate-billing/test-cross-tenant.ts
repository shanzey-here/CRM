import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: admin } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = admin!.tenant_id

  const { data: tenantB } = await serviceClient.from('tenants').insert([{ name: 'Tenant B Crate Billing Test', slug: `tenant-b-billing-${Date.now()}` }]).select().single()
  await serviceClient.from('pricing_settings').update({ crate_overdue_rate_per_day: 99, crate_lost_fee: 999 }).eq('tenant_id', tenantB!.id)

  const { data: contactB } = await serviceClient.from('contacts').insert({ tenant_id: tenantB!.id, first_name: 'TenantB', last_name: 'Contact' }).select().single()
  const { data: crateB } = await serviceClient
    .from('crates')
    .insert({ tenant_id: tenantB!.id, crate_number: 'TENANT-B-CRATE', status: 'with_customer', contact_id: contactB!.id, expected_return_date: '2020-01-01' })
    .select()
    .single()

  const rpcB = await serviceClient.rpc('create_crate_charge_invoice', {
    p_tenant_id: tenantB!.id,
    p_crate_id: crateB!.id,
    p_contact_id: contactB!.id,
    p_charge_type: 'overdue_fee',
    p_period_start: '2088-01-01',
    p_amount: 99,
    p_description: 'Tenant B private charge',
  })
  const chargeB = (rpcB.data as any).crate_charge_id
  console.log('Tenant B:', tenantB!.id, 'crate:', crateB!.id, 'charge:', chargeB)

  // RLS-scoped session as Tenant A
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  const { data: chargesVisible } = await anonClient.from('crate_charges').select('id, tenant_id')
  console.log("Tenant A can see Tenant B's crate_charges row (must be false):", (chargesVisible ?? []).some((c) => c.id === chargeB))

  const { data: directCharge } = await anonClient.from('crate_charges').select('*').eq('id', chargeB).maybeSingle()
  console.log("Direct fetch of Tenant B's charge by real ID as Tenant A (must be null):", directCharge)

  const { data: pricingA } = await anonClient.from('pricing_settings').select('tenant_id, crate_overdue_rate_per_day, crate_lost_fee')
  console.log("Tenant A's pricing_settings query returns Tenant B's row (must be false):", (pricingA ?? []).some((p) => p.tenant_id === tenantB!.id))
  console.log("Tenant A's own visible pricing rows:", JSON.stringify(pricingA))

  // Cleanup
  await serviceClient.from('crate_charges').delete().eq('id', chargeB)
  await serviceClient.from('crates').delete().eq('id', crateB!.id)
  await serviceClient.from('contacts').delete().eq('id', contactB!.id)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleanup complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
