import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function assertInsert(promise: any, table: string) {
  const { data, error } = await promise
  if (error) throw new Error(`Insert to ${table} failed: ${JSON.stringify(error)}`)
  return data
}

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Using dev tenant:', tenantId)

  // Ensure analytics entitlement is on (required for get_repeat_customers/get_contact_ltv, PT403 otherwise)
  const { data: existingModule } = await supabase.from('tenant_modules').select('id, enabled').eq('tenant_id', tenantId).eq('module_key', 'analytics').maybeSingle()
  if (existingModule && !existingModule.enabled) {
    await supabase.from('tenant_modules').update({ enabled: true }).eq('id', existingModule.id)
  } else if (!existingModule) {
    await supabase.from('tenant_modules').insert({ tenant_id: tenantId, module_key: 'analytics', enabled: true })
  }
  console.log('Analytics entitlement confirmed enabled for tenant')

  // --- Addresses (real, distinct cities so the timeline is visually verifiable) ---
  const addr = await assertInsert(
    supabase
      .from('addresses')
      .insert([
        { tenant_id: tenantId, line_1: '1 Baker Street', city: 'London', postcode: 'NW1 6XE' },
        { tenant_id: tenantId, line_1: '10 Deansgate', city: 'Manchester', postcode: 'M3 2GH' },
        { tenant_id: tenantId, line_1: '5 Royal Mile', city: 'Edinburgh', postcode: 'EH1 1RE' },
        { tenant_id: tenantId, line_1: '22 Corn Street', city: 'Bristol', postcode: 'BS1 1HT' },
      ])
      .select(),
    'addresses'
  )
  const [london, manchester, edinburgh, bristol] = addr

  // --- Primary contact: varied real history ---
  const primaryContact = await assertInsert(
    supabase
      .from('contacts')
      .insert({ tenant_id: tenantId, first_name: 'RelocationHistory', last_name: `Primary-${Date.now()}`, type: 'residential', email: `relocation-history-primary-${Date.now()}@example.com` })
      .select()
      .single(),
    'contacts'
  )
  console.log('Primary contact (expect: repeat customer, 2 completed + 1 cancelled + 1 declined + 1 expired):', primaryContact.id)

  // Quotes: 2 accepted (become jobs), 1 declined, 1 expired — distinct total_price each
  const quotes = await assertInsert(
    supabase
      .from('quotes')
      .insert([
        { tenant_id: tenantId, contact_id: primaryContact.id, status: 'accepted', total_price: 1200.0, subtotal: 1200.0, surcharge_total: 0, deposit_amount: 200, valid_until: daysAgo(58) }, // -> completed job A
        { tenant_id: tenantId, contact_id: primaryContact.id, status: 'accepted', total_price: 1850.5, subtotal: 1850.5, surcharge_total: 0, deposit_amount: 300, valid_until: daysAgo(18) }, // -> completed job B
        { tenant_id: tenantId, contact_id: primaryContact.id, status: 'accepted', total_price: 900.0, subtotal: 900.0, surcharge_total: 0, deposit_amount: 150, valid_until: daysAgo(8) }, // -> cancelled job
        { tenant_id: tenantId, contact_id: primaryContact.id, status: 'declined', total_price: 2400.0, subtotal: 2400.0, surcharge_total: 0, valid_until: daysAgo(5) },
        { tenant_id: tenantId, contact_id: primaryContact.id, status: 'expired', total_price: 1600.75, subtotal: 1600.75, surcharge_total: 0, valid_until: daysAgo(15) },
      ])
      .select(),
    'quotes'
  )
  const [quoteA, quoteB, quoteC, quoteDeclined, quoteExpired] = quotes
  console.log('Quotes:', { quoteA: quoteA.id, quoteB: quoteB.id, quoteC: quoteC.id, quoteDeclined: quoteDeclined.id, quoteExpired: quoteExpired.id })

  // Jobs: 2 completed (distinct move_date, linked to accepted quotes), 1 cancelled
  const jobs = await assertInsert(
    supabase
      .from('jobs')
      .insert([
        { tenant_id: tenantId, contact_id: primaryContact.id, quote_id: quoteA.id, status: 'completed', move_date: daysAgo(60), origin_address_id: london.id, destination_address_id: manchester.id },
        { tenant_id: tenantId, contact_id: primaryContact.id, quote_id: quoteB.id, status: 'completed', move_date: daysAgo(20), origin_address_id: manchester.id, destination_address_id: edinburgh.id },
        { tenant_id: tenantId, contact_id: primaryContact.id, quote_id: quoteC.id, status: 'cancelled', move_date: daysAgo(10), origin_address_id: edinburgh.id, destination_address_id: bristol.id },
      ])
      .select(),
    'jobs'
  )
  const [jobA, jobB, jobCancelled] = jobs
  console.log('Jobs:', { jobA: jobA.id, jobB: jobB.id, jobCancelled: jobCancelled.id })

  // Invoices + payments for the 2 completed jobs, to give LTV a real non-zero value
  const invoices = await assertInsert(
    supabase
      .from('invoices')
      .insert([
        { tenant_id: tenantId, contact_id: primaryContact.id, job_id: jobA.id, status: 'paid', subtotal: 1200.0, tax_amount: 0, total: 1200.0 },
        { tenant_id: tenantId, contact_id: primaryContact.id, job_id: jobB.id, status: 'paid', subtotal: 1850.5, tax_amount: 0, total: 1850.5 },
      ])
      .select(),
    'invoices'
  )
  await assertInsert(
    supabase
      .from('payments')
      .insert([
        { tenant_id: tenantId, invoice_id: invoices[0].id, amount: 1200.0, status: 'succeeded', method: 'card' },
        { tenant_id: tenantId, invoice_id: invoices[1].id, amount: 1850.5, status: 'succeeded', method: 'card' },
      ]),
    'payments'
  )
  console.log('Expected LTV for primary contact: 3050.50 (1200.00 + 1850.50)')

  // --- Control contact: only 1 completed job -> must NOT show repeat-customer badge ---
  const controlContact = await assertInsert(
    supabase
      .from('contacts')
      .insert({ tenant_id: tenantId, first_name: 'RelocationHistory', last_name: `Control-${Date.now()}`, type: 'residential', email: `relocation-history-control-${Date.now()}@example.com` })
      .select()
      .single(),
    'contacts'
  )
  const controlQuote = await assertInsert(
    supabase
      .from('quotes')
      .insert({ tenant_id: tenantId, contact_id: controlContact.id, status: 'accepted', total_price: 700.0, subtotal: 700.0, surcharge_total: 0 })
      .select()
      .single(),
    'quotes'
  )
  await assertInsert(
    supabase
      .from('jobs')
      .insert({ tenant_id: tenantId, contact_id: controlContact.id, quote_id: controlQuote.id, status: 'completed', move_date: daysAgo(3) }),
    'jobs'
  )
  console.log('Control contact (expect: NOT a repeat customer, only 1 completed job):', controlContact.id)

  console.log('\n=== FIXTURE IDS ===')
  console.log('TENANT_ID=' + tenantId)
  console.log('PRIMARY_CONTACT_ID=' + primaryContact.id)
  console.log('CONTROL_CONTACT_ID=' + controlContact.id)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
