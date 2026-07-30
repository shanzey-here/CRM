import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import {
  getContactLtv,
  getRepeatCustomers,
  getConversionFunnel
} from '../../src/modules/analytics/server/repository'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function assertInsert(promise: any, table: string) {
  const { error } = await promise
  if (error) throw new Error(`Insert to ${table} failed: ${JSON.stringify(error)}`)
}

async function main() {
  console.log('--- Starting Comprehensive Analytics DB Verification ---')

  const tenantId = crypto.randomUUID()
  
  await assertInsert(supabase.from('tenants').insert([
    { id: tenantId, name: 'Analytics Comprehensive Test Tenant', slug: `analytics-comp-${Date.now()}` }
  ]), 'tenants')

  await assertInsert(supabase.from('tenant_modules').insert([
    { id: crypto.randomUUID(), tenant_id: tenantId, module_key: 'analytics', enabled: true }
  ]), 'tenant_modules')

  console.log(`Tenant initialized: ${tenantId}`)

  // 1. Setup Contacts
  const contacts = Array.from({ length: 5 }, () => crypto.randomUUID())
  await assertInsert(supabase.from('contacts').insert(
    contacts.map((id, i) => ({ id, tenant_id: tenantId, first_name: `Contact${i}`, type: 'residential' }))
  ), 'contacts')

  // Contact 0: High value, repeat customer. 3 completed jobs.
  // Contact 1: Single completed job, one cancelled.
  // Contact 2: No jobs, just an inquiry.
  // Contact 3: 2 completed jobs (Repeat customer).
  // Contact 4: 1 scheduled job, 1 in_progress.

  // 2. Setup Jobs
  const jobs = []
  // Contact 0 (3 completed)
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[0], status: 'completed' })
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[0], status: 'completed' })
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[0], status: 'completed' })
  // Contact 1 (1 completed, 1 cancelled)
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[1], status: 'completed' })
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[1], status: 'cancelled' })
  // Contact 3 (2 completed)
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[3], status: 'completed' })
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[3], status: 'completed' })
  // Contact 4 (scheduled, in_progress)
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[4], status: 'scheduled' })
  jobs.push({ id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[4], status: 'in_progress' })

  await assertInsert(supabase.from('jobs').insert(jobs), 'jobs')

  // 3. Setup Invoices & Payments for LTV Testing
  // Contact 0: 
  //   Invoice 1 (Paid): $2000 total. Payments: $2000 succeeded.
  //   Invoice 2 (Partially Paid): $1000 total. Payments: $500 succeeded, $200 failed, $300 pending.
  //   Invoice 3 (Overdue): $500 total. Payments: $100 succeeded, $100 refunded.
  // Total expected LTV for Contact 0: 2000 + 500 + 100 = 2600.
  
  const c0_inv1 = crypto.randomUUID()
  const c0_inv2 = crypto.randomUUID()
  const c0_inv3 = crypto.randomUUID()
  
  await assertInsert(supabase.from('invoices').insert([
    { id: c0_inv1, tenant_id: tenantId, contact_id: contacts[0], status: 'paid', subtotal: 2000, tax_amount: 0, total: 2000 },
    { id: c0_inv2, tenant_id: tenantId, contact_id: contacts[0], status: 'partially_paid', subtotal: 1000, tax_amount: 0, total: 1000 },
    { id: c0_inv3, tenant_id: tenantId, contact_id: contacts[0], status: 'overdue', subtotal: 500, tax_amount: 0, total: 500 }
  ]), 'invoices')

  await assertInsert(supabase.from('payments').insert([
    // Inv 1
    { id: crypto.randomUUID(), tenant_id: tenantId, invoice_id: c0_inv1, amount: 2000, status: 'succeeded', method: 'card' },
    // Inv 2
    { id: crypto.randomUUID(), tenant_id: tenantId, invoice_id: c0_inv2, amount: 500, status: 'succeeded', method: 'card' },
    { id: crypto.randomUUID(), tenant_id: tenantId, invoice_id: c0_inv2, amount: 200, status: 'failed', method: 'card' },
    { id: crypto.randomUUID(), tenant_id: tenantId, invoice_id: c0_inv2, amount: 300, status: 'pending', method: 'card' },
    // Inv 3
    { id: crypto.randomUUID(), tenant_id: tenantId, invoice_id: c0_inv3, amount: 100, status: 'succeeded', method: 'card' },
    { id: crypto.randomUUID(), tenant_id: tenantId, invoice_id: c0_inv3, amount: 100, status: 'refunded', method: 'card' }
  ]), 'payments')

  // 4. Setup Funnel Metrics with Real Dates
  const today = new Date()
  const insideRange = new Date(today.getTime() - 10 * 86400000).toISOString() // 10 days ago
  const outsideRange = new Date(today.getTime() - 60 * 86400000).toISOString() // 60 days ago
  const windowStart = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
  const windowEnd = today.toISOString().split('T')[0]

  const leads = [
    // Inside range leads
    { id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[0], stage: 'completed', source: 'Google', created_at: insideRange },
    { id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[1], stage: 'quote_sent', source: 'Google', created_at: insideRange },
    { id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[2], stage: 'inquiry', source: 'Yelp', created_at: insideRange },
    // Outside range leads (should NOT be counted in this cohort)
    { id: crypto.randomUUID(), tenant_id: tenantId, contact_id: contacts[3], stage: 'completed', source: 'Facebook', created_at: outsideRange },
  ]
  await assertInsert(supabase.from('leads').insert(leads), 'leads')

  // Quotes
  // Lead 0 (Inside): 1 Accepted Quote
  // Lead 1 (Inside): 1 Draft Quote (Not accepted)
  // Lead 2 (Inside): No quotes
  // Lead 3 (Outside): 1 Accepted Quote (Should not artificially inflate the accepted_leads for the inside-range cohort)
  await assertInsert(supabase.from('quotes').insert([
    { id: crypto.randomUUID(), tenant_id: tenantId, lead_id: leads[0].id, contact_id: contacts[0], status: 'accepted', subtotal: 0, surcharge_total: 0, total_price: 0 },
    { id: crypto.randomUUID(), tenant_id: tenantId, lead_id: leads[1].id, contact_id: contacts[1], status: 'draft', subtotal: 0, surcharge_total: 0, total_price: 0 },
    { id: crypto.randomUUID(), tenant_id: tenantId, lead_id: leads[3].id, contact_id: contacts[3], status: 'accepted', subtotal: 0, surcharge_total: 0, total_price: 0 }
  ]), 'quotes')

  console.log('\n[1] Testing High-Complexity LTV...')
  const ltv = await getContactLtv(supabase, tenantId, contacts[0])
  console.log(`Contact 0 LTV: ${ltv} (Expected: 2600. Includes multiple invoices, ignores failed/pending/refunded)`)
  if (ltv !== 2600) throw new Error(`LTV Mismatch. Expected 2600, got ${ltv}`)

  console.log('\n[2] Testing Strict Repeat Customers...')
  const repeat = await getRepeatCustomers(supabase, tenantId)
  console.log(`Repeat Customers Found: ${repeat.length} (Expected: 2)`)
  
  // Sort for consistent checking
  repeat.sort((a, b) => b.completed_jobs_count - a.completed_jobs_count)
  
  if (repeat.length !== 2) throw new Error('Repeat customers count mismatch')
  console.log(`Customer ${repeat[0].contact_id} has ${repeat[0].completed_jobs_count} completed jobs (Expected: 3)`)
  console.log(`Customer ${repeat[1].contact_id} has ${repeat[1].completed_jobs_count} completed jobs (Expected: 2)`)
  
  if (repeat[0].completed_jobs_count !== 3 || repeat[1].completed_jobs_count !== 2) {
    throw new Error('Repeat customers jobs count mismatch')
  }
  
  // Ensure Contact 1 and Contact 4 are NOT in the list
  const repeatIds = repeat.map(r => r.contact_id)
  if (repeatIds.includes(contacts[1]) || repeatIds.includes(contacts[4])) {
    throw new Error('Non-repeat customers leaked into the repeat customers list')
  }

  console.log('\n[3] Testing Cohort Funnel Metric (Date boundary strictness)...')
  const funnel = await getConversionFunnel(supabase, tenantId, windowStart, windowEnd)
  console.log('Funnel Results:', JSON.stringify(funnel, null, 2))
  
  // Total inside range = 3. 
  // Quoted inside range = 2 (Lead 0, Lead 1). 
  // Accepted inside range = 1 (Lead 0). Lead 3 accepted is ignored because Lead 3 is outside the lead creation cohort.
  if (funnel.total_leads !== 3) throw new Error(`Funnel total_leads mismatch. Expected 3, got ${funnel.total_leads}`)
  if (funnel.quoted_leads !== 2) throw new Error(`Funnel quoted_leads mismatch. Expected 2, got ${funnel.quoted_leads}`)
  if (funnel.accepted_leads !== 1) throw new Error(`Funnel accepted_leads mismatch. Expected 1, got ${funnel.accepted_leads}`)
  if (funnel.sources['Google'] !== 2 || funnel.sources['Yelp'] !== 1) throw new Error('Funnel sources mismatch')

  console.log('\n[4] Cleanup...')
  await supabase.from('tenants').delete().eq('id', tenantId)
  console.log('Comprehensive verification complete. All logic rigorously verified.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
