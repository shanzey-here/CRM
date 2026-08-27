import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { publicCaptureAction } from '../src/app/embed/lead-capture/[widgetKey]/actions'
import { createClientCore } from '../src/app/office/clients/actions'

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
  console.log('  WEB WIDGET NEW-LEAD NOTIFICATION VERIFICATION TESTS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const srClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const tenantSlugA = `test-notif-a-${Date.now()}`
  const tenantSlugB = `test-notif-b-${Date.now()}`
  let tenantAId: string | null = null
  let tenantBId: string | null = null

  let adminAId: string | null = null
  let dispatcherAId: string | null = null
  let crewAId: string | null = null
  let adminBId: string | null = null

  let brandAWidgetKey: string | null = null
  let brandAId: string | null = null

  try {
    // 1. Setup Tenant A
    const { data: tenantA, error: tErrA } = await srClient
      .from('tenants')
      .insert({ name: 'Notification Test Tenant A', slug: tenantSlugA })
      .select().single()
    if (tErrA || !tenantA) throw new Error(`Failed to create Tenant A: ${tErrA?.message}`)
    tenantAId = tenantA.id

    // Setup Tenant B (for cross-tenant leakage verification)
    const { data: tenantB, error: tErrB } = await srClient
      .from('tenants')
      .insert({ name: 'Notification Test Tenant B', slug: tenantSlugB })
      .select().single()
    if (tErrB || !tenantB) throw new Error(`Failed to create Tenant B: ${tErrB?.message}`)
    tenantBId = tenantB.id

    // Get auto-provisioned default brand for Tenant A
    const { data: brandA } = await srClient
      .from('brands')
      .select('id, public_widget_key')
      .eq('tenant_id', tenantAId)
      .eq('is_default', true)
      .single()

    if (!brandA) throw new Error('Default brand for Tenant A not found')
    brandAWidgetKey = brandA.public_widget_key
    brandAId = brandA.id

    // Create Tenant A Users: 1 Admin, 1 Dispatcher, 1 Crew
    const adminId = crypto.randomUUID()
    const dispatcherId = crypto.randomUUID()
    const crewId = crypto.randomUUID()
    const adminBIdGen = crypto.randomUUID()

    const { data: adminA, error: adminErr } = await srClient
      .from('users')
      .insert({
        id: adminId,
        tenant_id: tenantAId,
        email: `admin-a-${Date.now()}@test.com`,
        full_name: 'Admin User',
        role: 'tenant_admin'
      })
      .select().single()
    if (adminErr || !adminA) throw new Error(`Failed to create admin user: ${adminErr?.message}`)
    adminAId = adminA.id

    const { data: dispatcherA, error: dispErr } = await srClient
      .from('users')
      .insert({
        id: dispatcherId,
        tenant_id: tenantAId,
        email: `dispatcher-a-${Date.now()}@test.com`,
        full_name: 'Dispatcher User',
        role: 'dispatcher'
      })
      .select().single()
    if (dispErr || !dispatcherA) throw new Error(`Failed to create dispatcher user: ${dispErr?.message}`)
    dispatcherAId = dispatcherA.id

    const { data: crewA, error: crewErr } = await srClient
      .from('users')
      .insert({
        id: crewId,
        tenant_id: tenantAId,
        email: `crew-a-${Date.now()}@test.com`,
        full_name: 'Crew User',
        role: 'crew'
      })
      .select().single()
    if (crewErr || !crewA) throw new Error(`Failed to create crew user: ${crewErr?.message}`)
    crewAId = crewA.id

    // Create Tenant B User: Admin
    const { data: adminB, error: adminBErr } = await srClient
      .from('users')
      .insert({
        id: adminBIdGen,
        tenant_id: tenantBId,
        email: `admin-b-${Date.now()}@test.com`,
        full_name: 'AdminB User',
        role: 'tenant_admin'
      })
      .select().single()
    if (adminBErr || !adminB) throw new Error(`Failed to create admin B user: ${adminBErr?.message}`)
    adminBId = adminB.id

    console.log('--- Test 1: Real Web Widget Submission (publicCaptureAction) ---')
    await test('publicCaptureAction creates lead and emits new_lead notifications for tenant_admin & dispatcher', async () => {
      // Simulate real widget submission payload
      const widgetPayload = {
        first_name: 'Web',
        last_name: 'Visitor',
        email: `visitor-${Date.now()}@example.com`,
        phone: '07123456789',
        origin_city: 'London',
        origin_postcode: 'SW1A 1AA',
        destination_city: 'Manchester',
        destination_postcode: 'M1 1AA',
        preferred_move_date: '2026-09-01',
        notes: '3 bedroom house move, requested via public widget',
      }

      const captureResult = await publicCaptureAction(brandAWidgetKey!, widgetPayload as any)
      if (!captureResult.success) {
        throw new Error(`publicCaptureAction failed: ${captureResult.error}`)
      }

      // Check lead created in database
      const { data: leads, error: leadErr } = await srClient
        .from('leads')
        .select('id, contact_id, source, stage')
        .eq('tenant_id', tenantAId!)
        .eq('source', 'web_widget')
        .order('created_at', { ascending: false })
        .limit(1)

      if (leadErr || !leads || leads.length === 0) {
        throw new Error(`Lead was not created in database: ${leadErr?.message}`)
      }
      const createdLead = leads[0]

      // Check domain_events record
      const { data: domainEvents, error: eventErr } = await srClient
        .from('domain_events')
        .select('*')
        .eq('tenant_id', tenantAId!)
        .eq('event_type', 'lead.created')
        .order('occurred_at', { ascending: false })
        .limit(1)

      if (eventErr || !domainEvents || domainEvents.length === 0) {
        throw new Error(`domain_events row not found: ${eventErr?.message}`)
      }

      const eventPayload = domainEvents[0].payload as any
      if (eventPayload.lead_id !== createdLead.id) {
        throw new Error(`Event payload lead_id mismatch: expected ${createdLead.id}, got ${eventPayload.lead_id}`)
      }

      // Check notifications generated for adminA and dispatcherA
      const { data: notifs, error: notifErr } = await srClient
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantAId!)
        .eq('notification_type', 'new_lead')

      if (notifErr) throw new Error(`Failed to query notifications: ${notifErr.message}`)

      const adminNotif = notifs?.find((n) => n.target_user_id === adminAId)
      const dispatcherNotif = notifs?.find((n) => n.target_user_id === dispatcherAId)
      const crewNotif = notifs?.find((n) => n.target_user_id === crewAId)

      if (!adminNotif) {
        throw new Error('Tenant Admin (adminA) did NOT receive a new_lead notification!')
      }
      if (!dispatcherNotif) {
        throw new Error('Dispatcher (dispatcherA) did NOT receive a new_lead notification!')
      }
      if (crewNotif) {
        throw new Error('Crew user received new_lead notification (should be restricted to admin/dispatcher)!')
      }

      if (adminNotif.title !== 'New Lead' || adminNotif.action_url !== `/office/leads/${createdLead.id}`) {
        throw new Error(`Admin notification data mismatch: ${JSON.stringify(adminNotif)}`)
      }

      // Check cross-tenant isolation (Tenant B users must NOT receive Tenant A notifications)
      const { data: tenantBNotifs } = await srClient
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantBId!)

      if (tenantBNotifs && tenantBNotifs.length > 0) {
        throw new Error(`Tenant B received ${tenantBNotifs.length} leaked notifications!`)
      }
    })

    console.log('\n--- Test 2: Regression Check for Manual Client/Lead Creation ---')
    await test('createClientCore with manual lead data emits notification to admin & dispatcher', async () => {
      const manualPayload = {
        first_name: 'Manual',
        last_name: 'Client',
        email: `manual-${Date.now()}@example.com`,
        phone: '07999888777',
        type: 'residential' as const,
        source: 'referral',
        origin_city: 'Bristol',
        destination_city: 'Bath',
      }

      // Simulate office action call
      const clientResult = await createClientCore(
        srClient,
        tenantAId!,
        manualPayload as any,
        adminAId!, // authenticated user ID
        true,
        brandAId!
      )

      if (!clientResult.success) {
        throw new Error(`createClientCore failed: ${clientResult.error}`)
      }

      // Verify that new notification was inserted for dispatcher
      const { data: notifs } = await srClient
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantAId!)
        .eq('target_user_id', dispatcherAId!)
        .order('created_at', { ascending: false })

      // Dispatcher should now have 2 notifications (1 from widget test, 1 from manual client creation)
      if (!notifs || notifs.length < 2) {
        throw new Error(`Expected at least 2 notifications for dispatcher, got ${notifs?.length}`)
      }
    })

  } finally {
    // Clean up test data
    console.log('\nCleaning up test data...')
    if (tenantAId) {
      await srClient.from('notifications').delete().eq('tenant_id', tenantAId)
      await srClient.from('domain_events').delete().eq('tenant_id', tenantAId)
      await srClient.from('leads').delete().eq('tenant_id', tenantAId)
      await srClient.from('contacts').delete().eq('tenant_id', tenantAId)
      await srClient.from('addresses').delete().eq('tenant_id', tenantAId)
      await srClient.from('users').delete().eq('tenant_id', tenantAId)
      await srClient.from('brands').delete().eq('tenant_id', tenantAId)
      await srClient.from('tenants').delete().eq('id', tenantAId)
    }
    if (tenantBId) {
      await srClient.from('users').delete().eq('tenant_id', tenantBId)
      await srClient.from('brands').delete().eq('tenant_id', tenantBId)
      await srClient.from('tenants').delete().eq('id', tenantBId)
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
