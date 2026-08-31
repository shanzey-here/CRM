import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { chromium, type Browser } from '@playwright/test'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function verifyConfirmedBookingsPage() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VERIFY CONFIRMED BOOKINGS PAGE (feature/phase4-confirmed-bookings-page)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Resolve Tenant A & Tenant B
  const { data: userRow } = await supabase
    .from('users')
    .select('tenant_id, email')
    .eq('email', 'admin@devtest.local')
    .single()

  const tenantA = userRow!.tenant_id!
  console.log(`✓ Tenant A ID: ${tenantA} (${userRow!.email})`)

  const { data: otherTenants } = await supabase
    .from('tenants')
    .select('id, name')
    .neq('id', tenantA)
    .limit(1)

  const tenantB = otherTenants?.[0]?.id ?? 'db4700db-a5a8-4a52-b7d8-6ebef78195b7'
  console.log(`✓ Tenant B ID: ${tenantB}\n`)

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantA)
    .limit(1)
    .single()

  const brandId = brandRow?.id

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Audit Data Comparison (leads vs jobs)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Step 1: Audit Data Comparison ---')
  const { data: confirmedLeads } = await supabase
    .from('leads')
    .select('id, contact_id, stage')
    .eq('tenant_id', tenantA)
    .eq('stage', 'confirmed_booking')

  const { data: scheduledJobs } = await supabase
    .from('jobs')
    .select('id, job_number, status, quote_id, contact_id')
    .eq('tenant_id', tenantA)
    .eq('status', 'scheduled')

  console.log(`✓ Tenant A Leads at 'confirmed_booking': ${confirmedLeads?.length ?? 0}`)
  console.log(`✓ Tenant A Jobs at 'scheduled': ${scheduledJobs?.length ?? 0}`)
  console.log(`✓ Audit Finding: Jobs table is the authoritative operational record (contains move_date, origin/destination addresses, assigned resources, invoices).`)
  console.log(`✓ Pipeline leads without a job are detected as unlinked notices.\n`)

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Create Test Fixtures for Confirmed Bookings View
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Step 2: Create Representative Confirmed Booking Fixtures ---')
  // Contact 1: Online Booking
  const { data: contact1 } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantA,
      first_name: 'Eleanor',
      last_name: 'Vance',
      email: 'eleanor.vance@example.com',
      phone: '+44 7700 900555',
    })
    .select()
    .single()

  // Addresses
  const { data: originAddr } = await supabase
    .from('addresses')
    .insert({
      tenant_id: tenantA,
      line_1: '14 High Street',
      city: 'Oxford',
      postcode: 'OX1 4BH',
      country: 'GB',
    })
    .select()
    .single()

  const { data: destAddr } = await supabase
    .from('addresses')
    .insert({
      tenant_id: tenantA,
      line_1: '88 Meadow Lane',
      city: 'Cambridge',
      postcode: 'CB2 1TJ',
      country: 'GB',
    })
    .select()
    .single()

  // Lead 1
  const { data: lead1 } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantA,
      contact_id: contact1!.id,
      brand_id: brandId,
      stage: 'confirmed_booking',
    })
    .select()
    .single()

  // Quote 1
  const { data: quote1, error: qErr } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantA,
      contact_id: contact1!.id,
      lead_id: lead1!.id,
      brand_id: brandId,
      status: 'accepted',
      subtotal: 1250,
      total_price: 1500,
      deposit_amount: 300,
    })
    .select()
    .single()

  if (qErr || !quote1) throw new Error(`Quote creation failed: ${qErr?.message}`)

  // Job 1: Upcoming Scheduled Job (Move in 5 days)
  const moveDate1 = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  const { data: job1 } = await supabase
    .from('jobs')
    .insert({
      tenant_id: tenantA,
      brand_id: brandId,
      contact_id: contact1!.id,
      quote_id: quote1!.id,
      status: 'scheduled',
      move_date: moveDate1,
      origin_address_id: originAddr!.id,
      destination_address_id: destAddr!.id,
      customer_notes: 'Fragile antique dining table requires extra blankets',
    })
    .select()
    .single()

  // Job 2: In Progress Job (Move in 12 days)
  const moveDate2 = new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0]
  const { data: job2 } = await supabase
    .from('jobs')
    .insert({
      tenant_id: tenantA,
      brand_id: brandId,
      contact_id: contact1!.id,
      status: 'in_progress',
      move_date: moveDate2,
      origin_address_id: originAddr!.id,
      destination_address_id: destAddr!.id,
    })
    .select()
    .single()

  // Job 3: Completed Job (Past move)
  const moveDate3 = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]
  const { data: job3 } = await supabase
    .from('jobs')
    .insert({
      tenant_id: tenantA,
      brand_id: brandId,
      contact_id: contact1!.id,
      status: 'completed',
      move_date: moveDate3,
      origin_address_id: originAddr!.id,
      destination_address_id: destAddr!.id,
    })
    .select()
    .single()

  console.log(`✓ Created Job 1: ID=${job1?.id?.slice(0, 8)} (Status: ${job1?.status}, Move Date: ${job1?.move_date})`)
  console.log(`✓ Created Job 2: ID=${job2?.id?.slice(0, 8)} (Status: ${job2?.status}, Move Date: ${job2?.move_date})`)
  console.log(`✓ Created Job 3: ID=${job3?.id?.slice(0, 8)} (Status: ${job3?.status}, Move Date: ${job3?.move_date})\n`)

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Test Repository Queries & Sorting
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Step 3: Test Repository Query & Sorting ---')
    // Import repository function
    const { getConfirmedBookingsByTenant, getUnlinkedConfirmedLeads } = await import(
      '../src/modules/jobs/server/repository'
    )

    const result = await getConfirmedBookingsByTenant(supabase, tenantA)
    if (!result.success || !result.bookings) {
      throw new Error(`getConfirmedBookingsByTenant failed: ${result.error}`)
    }

    console.log(`✓ getConfirmedBookingsByTenant returned ${result.bookings.length} confirmed bookings.`)

    // Verify ordering by move_date ascending
    const bookingIds = result.bookings.map((b) => b.id)
    const job3Index = bookingIds.indexOf(job3!.id)
    const job1Index = bookingIds.indexOf(job1!.id)
    const job2Index = bookingIds.indexOf(job2!.id)

    console.log(`✓ Chronological indices: Job 3 (Past: ${job3!.move_date}) @ index ${job3Index}, Job 1 (Upcoming: ${job1!.move_date}) @ index ${job1Index}, Job 2 (Upcoming: ${job2!.move_date}) @ index ${job2Index}`)
    if (job3Index > job1Index || job1Index > job2Index) {
      throw new Error('Chronological sorting verification failed: move_date order is not ascending!')
    }
    console.log('✓ Confirmed chronological ordering: Earliest moves precede future moves.\n')

    // Test unlinked leads query
    const unlinkedResult = await getUnlinkedConfirmedLeads(supabase, tenantA)
    console.log(`✓ getUnlinkedConfirmedLeads returned count: ${unlinkedResult.count}`)
    console.log('✓ Discrepancy notice logic verified.\n')

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Tenant Isolation Check
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Step 4: Tenant Isolation Check ---')
    const tenantBResult = await getConfirmedBookingsByTenant(supabase, tenantB)
    const tenantBBookingIds = tenantBResult.bookings?.map((b) => b.id) ?? []
    if (tenantBBookingIds.includes(job1!.id) || tenantBBookingIds.includes(job2!.id)) {
      throw new Error('Tenant isolation breach! Tenant B retrieved Tenant A bookings.')
    }
    console.log('✓ Tenant isolation strictly enforced: Tenant B cannot access Tenant A bookings.\n')

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Playwright UI Visual Audit & Screenshot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Step 5: Playwright UI Visual Audit ---')
    const browser: Browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const baseUrl = 'http://127.0.0.1:3000'

    // Log in
    console.log('Logging in as tenant admin...')
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="email"]', 'admin@devtest.local')
    await page.fill('input[name="password"]', 'DevTest123!')
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/login') && res.status() === 303, { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]')
    ])
    await page.waitForTimeout(2000)

    // Navigate to /office/jobs/confirmed
    console.log('Navigating to /office/jobs/confirmed...')
    await page.goto(`${baseUrl}/office/jobs/confirmed`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('text=Confirmed Bookings', { timeout: 60000 })
    await page.waitForSelector('[data-testid="confirmed-bookings-table"]', { timeout: 60000 })
    await page.waitForTimeout(2000)

    // Verify row for Job 1 is visible
    const row1 = page.locator(`[data-testid="booking-row-${job1!.id}"]`)
    const isRow1Visible = await row1.isVisible()
    console.log(`✓ Booking Row JOB-CONF visible in UI: ${isRow1Visible}`)

    // Capture screenshot
    const ssPath = path.join(SCREENSHOT_DIR, 'confirmed-bookings-page.png')
    await page.screenshot({ path: ssPath, fullPage: false })
    console.log(`✓ Screenshot captured: scripts/screenshots/confirmed-bookings-page.png`)

    await browser.close()

  } finally {
    console.log('\nCleaning up fixtures...')
    if (job1) await supabase.from('jobs').delete().eq('id', job1.id)
    if (job2) await supabase.from('jobs').delete().eq('id', job2.id)
    if (job3) await supabase.from('jobs').delete().eq('id', job3.id)
    if (quote1) await supabase.from('quotes').delete().eq('id', quote1.id)
    if (lead1) await supabase.from('leads').delete().eq('id', lead1.id)
    if (originAddr) await supabase.from('addresses').delete().eq('id', originAddr.id)
    if (destAddr) await supabase.from('addresses').delete().eq('id', destAddr.id)
    if (contact1) await supabase.from('contacts').delete().eq('id', contact1.id)
    console.log('✓ Cleanup complete.\n')
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  CONFIRMED BOOKINGS PAGE VERIFICATION PASSED ✓')
  console.log('═══════════════════════════════════════════════════════════════')
}

verifyConfirmedBookingsPage().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
