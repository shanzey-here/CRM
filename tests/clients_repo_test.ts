import { createClient } from '@supabase/supabase-js'
import { getContacts, createContact } from '../src/modules/clients/server/repository'

// Assuming a standard local Supabase instance
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// We use the service_role key to bypass RLS so we can explicitly test
// that the *repository-level* tenantId scoping is functioning correctly.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function runTest() {
  console.log('--- Running Clients Repository Cross-Tenant Test ---')

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  // 1. Create a contact for Tenant A
  console.log('Creating contact for Tenant A...')
  const { data: contactA, error: errA } = await createContact(supabase, tenantA, {
    first_name: 'Alice',
    last_name: 'Tenant A',
    type: 'residential',
  })

  if (errA || !contactA) {
    console.error('Failed to create contact for Tenant A:', errA)
    process.exit(1)
  }

  // 2. Create a contact for Tenant B
  console.log('Creating contact for Tenant B...')
  const { data: contactB, error: errB } = await createContact(supabase, tenantB, {
    first_name: 'Bob',
    last_name: 'Tenant B',
    type: 'residential',
  })

  if (errB || !contactB) {
    console.error('Failed to create contact for Tenant B:', errB)
    process.exit(1)
  }

  // 3. Fetch contacts for Tenant A and ensure Bob is not included
  console.log('Fetching contacts for Tenant A...')
  const { data: contactsA, error: fetchErrA } = await getContacts(supabase, tenantA)
  if (fetchErrA) throw fetchErrA

  const hasBob = contactsA?.some(c => c.first_name === 'Bob')
  if (hasBob) {
    console.error('FAIL: Tenant A repository query returned Tenant B data!')
    process.exit(1)
  } else {
    console.log('PASS: Tenant A query successfully isolated from Tenant B data.')
  }

  // 4. Fetch contacts for Tenant B and ensure Alice is not included
  console.log('Fetching contacts for Tenant B...')
  const { data: contactsB, error: fetchErrB } = await getContacts(supabase, tenantB)
  if (fetchErrB) throw fetchErrB

  const hasAlice = contactsB?.some(c => c.first_name === 'Alice')
  if (hasAlice) {
    console.error('FAIL: Tenant B repository query returned Tenant A data!')
    process.exit(1)
  } else {
    console.log('PASS: Tenant B query successfully isolated from Tenant A data.')
  }

  // Cleanup
  console.log('Cleaning up test data...')
  await supabase.from('contacts').delete().in('id', [contactA.id, contactB.id])

  console.log('--- Test Completed Successfully ---')
}

runTest().catch(err => {
  console.error('Test failed with unhandled exception:', err)
  process.exit(1)
})
