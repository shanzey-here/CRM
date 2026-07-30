import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: admin } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = admin!.tenant_id

  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Relocation History Test', slug: `tenant-b-relocation-history-${Date.now()}` }])
    .select()
    .single()

  const { data: contactB } = await serviceClient
    .from('contacts')
    .insert({ tenant_id: tenantB!.id, first_name: 'TenantB', last_name: 'Contact' })
    .select()
    .single()

  const { data: quoteB } = await serviceClient
    .from('quotes')
    .insert({ tenant_id: tenantB!.id, contact_id: contactB!.id, status: 'accepted', total_price: 5000, subtotal: 5000, surcharge_total: 0 })
    .select()
    .single()

  const { data: jobB } = await serviceClient
    .from('jobs')
    .insert({ tenant_id: tenantB!.id, contact_id: contactB!.id, quote_id: quoteB!.id, status: 'completed', move_date: '2026-07-01' })
    .select()
    .single()

  const { data: declinedQuoteB } = await serviceClient
    .from('quotes')
    .insert({ tenant_id: tenantB!.id, contact_id: contactB!.id, status: 'declined', total_price: 9999, subtotal: 9999, surcharge_total: 0 })
    .select()
    .single()

  console.log('Tenant B:', tenantB!.id, 'contact:', contactB!.id, 'job:', jobB!.id, 'declined quote:', declinedQuoteB!.id)

  // Real RLS-scoped session as Tenant A staff
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  const { getContactRelocationHistory } = await import('../../src/modules/clients/server/repository')
  const { getContactById } = await import('../../src/modules/clients/server/repository')

  console.log('\n=== As Tenant A, fetching Tenant B contact by real id directly (must be null) ===')
  const { data: crossContact, error: crossContactErr } = await getContactById(anonClient as any, tenantAId, contactB!.id)
  console.log('Contact:', crossContact, 'Error:', crossContactErr?.message)

  console.log('\n=== As Tenant A, getContactRelocationHistory(tenantA, tenantB_contact_id) — must return empty ===')
  const history = await getContactRelocationHistory(anonClient as any, tenantAId, contactB!.id)
  console.log(JSON.stringify(history, null, 2))

  console.log('\n=== As Tenant A, getContactRelocationHistory(tenantB_id, tenantB_contact_id) — even with correct tenantB id passed explicitly, RLS must still block (session is Tenant A) ===')
  const historyWithForeignTenantId = await getContactRelocationHistory(anonClient as any, tenantB!.id, contactB!.id)
  console.log(JSON.stringify(historyWithForeignTenantId, null, 2))

  // Cleanup
  await serviceClient.from('jobs').delete().eq('id', jobB!.id)
  await serviceClient.from('quotes').delete().in('id', [quoteB!.id, declinedQuoteB!.id])
  await serviceClient.from('contacts').delete().eq('id', contactB!.id)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleanup complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
