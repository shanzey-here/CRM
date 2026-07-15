import { createClient } from '@supabase/supabase-js'
import { createContact } from '../src/modules/clients/server/repository'
import { getLeads, getLeadById, createLead } from '../src/modules/leads/server/repository'

// Assuming a standard local Supabase instance
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// We use the service_role key to bypass RLS so we can explicitly test
// that the *repository-level* tenantId scoping is functioning correctly.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function runTest() {
  console.log('--- Running Leads Repository Cross-Tenant Test ---')

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  // This runs against a shared, non-resettable database — cleanup must run
  // even if an assertion fails partway through, or a failed run leaks rows.
  let failed = false
  const createdLeadIds: string[] = []
  const createdContactIds: string[] = []

  try {
    // 1. Leads require a contact_id — create one contact per tenant first
    console.log('Creating prerequisite contacts...')
    const { data: contactA, error: contactErrA } = await createContact(supabase, tenantA, {
      first_name: 'Alice',
      last_name: 'Tenant A',
      type: 'residential',
    })
    if (contactErrA || !contactA) {
      console.error('Failed to create contact for Tenant A:', contactErrA)
      failed = true
      return
    }
    createdContactIds.push(contactA.id)

    const { data: contactB, error: contactErrB } = await createContact(supabase, tenantB, {
      first_name: 'Bob',
      last_name: 'Tenant B',
      type: 'residential',
    })
    if (contactErrB || !contactB) {
      console.error('Failed to create contact for Tenant B:', contactErrB)
      failed = true
      return
    }
    createdContactIds.push(contactB.id)

    // 2. Create a lead in each tenant
    console.log('Creating lead for Tenant A...')
    const { data: leadA, error: leadErrA } = await createLead(supabase, tenantA, {
      contact_id: contactA.id,
      stage: 'inquiry',
      source: 'website_form',
    })
    if (leadErrA || !leadA) {
      console.error('Failed to create lead for Tenant A:', leadErrA)
      failed = true
      return
    }
    createdLeadIds.push(leadA.id)

    console.log('Creating lead for Tenant B...')
    const { data: leadB, error: leadErrB } = await createLead(supabase, tenantB, {
      contact_id: contactB.id,
      stage: 'inquiry',
      source: 'referral',
    })
    if (leadErrB || !leadB) {
      console.error('Failed to create lead for Tenant B:', leadErrB)
      failed = true
      return
    }
    createdLeadIds.push(leadB.id)

    // 3. Fetch leads for Tenant A and ensure Tenant B's lead is not included
    console.log('Fetching leads for Tenant A...')
    const { data: leadsA, error: fetchErrA } = await getLeads(supabase, tenantA)
    if (fetchErrA) throw fetchErrA

    const hasLeadB = leadsA?.some(l => l.id === leadB.id)
    if (hasLeadB) {
      console.error('FAIL: Tenant A leads query returned Tenant B data!')
      failed = true
    } else {
      console.log('PASS: Tenant A leads query successfully isolated from Tenant B data.')
    }

    // 4. Fetch leads for Tenant B and ensure Tenant A's lead is not included
    console.log('Fetching leads for Tenant B...')
    const { data: leadsB, error: fetchErrB } = await getLeads(supabase, tenantB)
    if (fetchErrB) throw fetchErrB

    const hasLeadA = leadsB?.some(l => l.id === leadA.id)
    if (hasLeadA) {
      console.error('FAIL: Tenant B leads query returned Tenant A data!')
      failed = true
    } else {
      console.log('PASS: Tenant B leads query successfully isolated from Tenant A data.')
    }

    // 5. getLeadById must not resolve a lead belonging to another tenant
    console.log('Attempting cross-tenant getLeadById...')
    const { data: crossFetch } = await getLeadById(supabase, tenantA, leadB.id)
    if (crossFetch) {
      console.error('FAIL: getLeadById resolved a lead belonging to another tenant!')
      failed = true
    } else {
      console.log('PASS: getLeadById correctly scoped — cannot fetch cross-tenant lead by id.')
    }
  } catch (err) {
    console.error('Test failed with unhandled exception:', err)
    failed = true
  } finally {
    console.log('Cleaning up test data...')
    if (createdLeadIds.length > 0) {
      const { error: leadCleanupErr } = await supabase.from('leads').delete().in('id', createdLeadIds)
      if (leadCleanupErr) {
        console.error('WARNING: Lead cleanup failed — test data may have leaked:', leadCleanupErr)
        failed = true
      }
    }
    if (createdContactIds.length > 0) {
      const { error: contactCleanupErr } = await supabase.from('contacts').delete().in('id', createdContactIds)
      if (contactCleanupErr) {
        console.error('WARNING: Contact cleanup failed — test data may have leaked:', contactCleanupErr)
        failed = true
      }
    }
  }

  if (failed) {
    console.error('--- Test FAILED ---')
    process.exit(1)
  }

  console.log('--- Test Completed Successfully ---')
}

runTest()
