import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { getContactDisplayName } from '../src/app/office/leads/components/lead-card'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

let testCounter = 0
let failedCount = 0

async function test(name: string, fn: () => Promise<void> | void) {
  testCounter++
  try {
    await fn()
    console.log(`✓ Test ${testCounter}: ${name}`)
  } catch (err) {
    failedCount++
    console.error(`✗ Test ${testCounter}: ${name}`)
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  LEAD CARD CONTACT NAME DISPLAY VERIFICATION TESTS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. UNIT TESTS for getContactDisplayName
  console.log('--- Unit Tests: getContactDisplayName Fallback Logic ---')

  await test('Returns "First Last" when both are present', () => {
    const res = getContactDisplayName({ first_name: 'Jane', last_name: 'Doe' })
    if (res !== 'Jane Doe') throw new Error(`Expected "Jane Doe", got "${res}"`)
  })

  await test('Returns "First" when only first_name is present', () => {
    const res = getContactDisplayName({ first_name: 'John', last_name: null })
    if (res !== 'John') throw new Error(`Expected "John", got "${res}"`)
  })

  await test('Returns "Last" when only last_name is present', () => {
    const res = getContactDisplayName({ first_name: '', last_name: 'Smith' })
    if (res !== 'Smith') throw new Error(`Expected "Smith", got "${res}"`)
  })

  await test('Falls back to company_name when first and last are empty/null', () => {
    const res = getContactDisplayName({ first_name: null, last_name: '', company_name: 'Acme Relocations' })
    if (res !== 'Acme Relocations') throw new Error(`Expected "Acme Relocations", got "${res}"`)
  })

  await test('Falls back to email when name and company are empty/null', () => {
    const res = getContactDisplayName({ first_name: null, last_name: null, company_name: '', email: 'visitor@example.com' })
    if (res !== 'visitor@example.com') throw new Error(`Expected "visitor@example.com", got "${res}"`)
  })

  await test('Falls back to phone when name, company, and email are empty/null', () => {
    const res = getContactDisplayName({ first_name: '', last_name: '', company_name: null, email: null, phone: '+44 7123 456789' })
    if (res !== '+44 7123 456789') throw new Error(`Expected "+44 7123 456789", got "${res}"`)
  })

  await test('Falls back to "Unnamed Contact" when all contact fields are null or empty', () => {
    const res = getContactDisplayName({ first_name: '', last_name: null, company_name: '', email: null, phone: '' })
    if (res !== 'Unnamed Contact') throw new Error(`Expected "Unnamed Contact", got "${res}"`)
  })

  await test('Falls back to "Unnamed Contact" when contact is null or undefined', () => {
    const resNull = getContactDisplayName(null)
    const resUndef = getContactDisplayName(undefined)
    if (resNull !== 'Unnamed Contact' || resUndef !== 'Unnamed Contact') {
      throw new Error(`Expected "Unnamed Contact", got "${resNull}" / "${resUndef}"`)
    }
  })

  await test('Handles array of contact objects defensively', () => {
    const res = getContactDisplayName([{ first_name: 'Alice', last_name: 'Wonderland' }])
    if (res !== 'Alice Wonderland') throw new Error(`Expected "Alice Wonderland", got "${res}"`)
  })

  // 2. DATABASE INTEGRATION TEST
  console.log('\n--- Database Integration: Leads Query with Contact Join ---')

  const srClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const tempTenantSlug = `test-lead-card-${Date.now()}`
  let testTenantId: string | null = null
  const createdLeadIds: string[] = []
  const createdContactIds: string[] = []

  try {
    const { data: tenant, error: tenantErr } = await srClient
      .from('tenants')
      .insert({ name: 'Lead Card Test Tenant', slug: tempTenantSlug })
      .select()
      .single()

    if (tenantErr || !tenant) {
      throw new Error(`Failed to create test tenant: ${tenantErr?.message}`)
    }
    testTenantId = tenant.id

    // Fetch the auto-provisioned default brand
    const { data: brand } = await srClient
      .from('brands')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('is_default', true)
      .single()

    const brandId = brand?.id

    // Create 3 contacts:
    // 1. Contact with full name
    const { data: c1 } = await srClient
      .from('contacts')
      .insert({ tenant_id: testTenantId, first_name: 'Sarah', last_name: 'Connor', type: 'residential', email: 'sarah@skynet.com' })
      .select().single()
    createdContactIds.push(c1!.id)

    // 2. Contact from Web Widget with only email (no name)
    const { data: c2 } = await srClient
      .from('contacts')
      .insert({ tenant_id: testTenantId, first_name: '', last_name: null, type: 'residential', email: 'widget_user@test.org' })
      .select().single()
    createdContactIds.push(c2!.id)

    // 3. Contact with company name only
    const { data: c3 } = await srClient
      .from('contacts')
      .insert({ tenant_id: testTenantId, first_name: '', last_name: null, company_name: 'Cyberdyne Systems', type: 'commercial' })
      .select().single()
    createdContactIds.push(c3!.id)

    // Create leads
    const { data: l1 } = await srClient
      .from('leads')
      .insert({ tenant_id: testTenantId, contact_id: c1!.id, brand_id: brandId, stage: 'inquiry' })
      .select().single()
    createdLeadIds.push(l1!.id)

    const { data: l2 } = await srClient
      .from('leads')
      .insert({ tenant_id: testTenantId, contact_id: c2!.id, brand_id: brandId, stage: 'inquiry', source: 'web_widget' })
      .select().single()
    createdLeadIds.push(l2!.id)

    const { data: l3 } = await srClient
      .from('leads')
      .insert({ tenant_id: testTenantId, contact_id: c3!.id, brand_id: brandId, stage: 'quote_sent' })
      .select().single()
    createdLeadIds.push(l3!.id)

    // Execute the exact query that /office/leads/page.tsx executes
    await test('Office Leads query joins contacts and getContactDisplayName formats them correctly', async () => {
      const { data: leads, error } = await srClient
        .from('leads')
        .select(`
          id,
          contact_id,
          stage,
          preferred_move_date,
          estimated_volume,
          origin_address_id,
          destination_address_id,
          notes,
          created_at,
          updated_at,
          is_archived,
          tenant_id,
          source,
          assigned_to,
          created_by,
          updated_by,
          contact:contacts(first_name, last_name, email, phone, company_name)
        `)
        .eq('tenant_id', testTenantId)
        .eq('is_archived', false)
        .in('stage', ['inquiry', 'quote_sent'])
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Query failed: ${error.message}`)
      if (!leads || leads.length !== 3) throw new Error(`Expected 3 leads, got ${leads?.length}`)

      const lead1 = leads.find((l) => l.id === l1!.id)
      const lead2 = leads.find((l) => l.id === l2!.id)
      const lead3 = leads.find((l) => l.id === l3!.id)

      const name1 = getContactDisplayName(lead1?.contact as any)
      const name2 = getContactDisplayName(lead2?.contact as any)
      const name3 = getContactDisplayName(lead3?.contact as any)

      if (name1 !== 'Sarah Connor') throw new Error(`Expected "Sarah Connor", got "${name1}"`)
      if (name2 !== 'widget_user@test.org') throw new Error(`Expected "widget_user@test.org", got "${name2}"`)
      if (name3 !== 'Cyberdyne Systems') throw new Error(`Expected "Cyberdyne Systems", got "${name3}"`)
    })

  } finally {
    // Cleanup
    if (createdLeadIds.length > 0) {
      await srClient.from('leads').delete().in('id', createdLeadIds)
    }
    if (createdContactIds.length > 0) {
      await srClient.from('contacts').delete().in('id', createdContactIds)
    }
    if (testTenantId) {
      await srClient.from('brands').delete().eq('tenant_id', testTenantId)
      await srClient.from('tenants').delete().eq('id', testTenantId)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  if (failedCount > 0) {
    console.error(`  ${failedCount} out of ${testCounter} tests failed!`)
    process.exit(1)
  } else {
    console.log(`  All ${testCounter} tests passed successfully ✓`)
    console.log('═══════════════════════════════════════════════════════════════\n')
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err)
  process.exit(1)
})
