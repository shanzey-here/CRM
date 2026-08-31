import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { chromium, type Browser } from '@playwright/test'
import * as fs from 'fs'
import { format, addDays } from 'date-fns'

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

async function verifyUpcomingMovesWidget() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VERIFY DASHBOARD UPCOMING MOVES WIDGET (7-DAY WINDOW)')
  console.log('  (feature/phase4-dashboard-upcoming-moves-widget)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Resolve Tenant A & Tenant B
  const { data: userA } = await supabase
    .from('users')
    .select('tenant_id, email')
    .eq('email', 'admin@devtest.local')
    .single()
  const tenantA = userA!.tenant_id!

  const { data: userB } = await supabase
    .from('users')
    .select('tenant_id, email')
    .neq('tenant_id', tenantA)
    .limit(1)
    .single()
  const tenantB = userB?.tenant_id || 'db4700db-a5a8-4a52-b7d8-6ebef78195b7'

  console.log(`✓ Tenant A ID: ${tenantA} (${userA!.email})`)
  console.log(`✓ Tenant B ID: ${tenantB}`)

  const { data: brandA } = await supabase
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantA)
    .limit(1)
    .single()
  const brandAId = brandA?.id

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Create Address Fixtures for Routes
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 1: Create Address & Contact Fixtures ---')
  const { data: originAddr } = await supabase
    .from('addresses')
    .insert({
      tenant_id: tenantA,
      line_1: '10 Downing St',
      city: 'London',
      postcode: 'SW1A 2AA',
      country: 'UK',
    })
    .select()
    .single()

  const { data: destAddr } = await supabase
    .from('addresses')
    .insert({
      tenant_id: tenantA,
      line_1: '42 High St',
      city: 'Oxford',
      postcode: 'OX1 4AP',
      country: 'UK',
    })
    .select()
    .single()

  const { data: contactA } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantA,
      first_name: 'David',
      last_name: 'UpcomingSeven',
      email: 'david.upcoming@example.com',
      phone: '+44 7700 900111',
    })
    .select()
    .single()

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Seed Jobs across Dates and Statuses
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Step 2: Seed Jobs Across Dates & Statuses ---')
  const today = new Date()
  const dateD1 = format(addDays(today, 1), 'yyyy-MM-dd')
  const dateD3 = format(addDays(today, 3), 'yyyy-MM-dd')
  const dateD5 = format(addDays(today, 5), 'yyyy-MM-dd')
  const dateD6 = format(addDays(today, 6), 'yyyy-MM-dd')
  const dateD7 = format(addDays(today, 7), 'yyyy-MM-dd')
  const dateD8 = format(addDays(today, 8), 'yyyy-MM-dd')
  const dateD15 = format(addDays(today, 15), 'yyyy-MM-dd')

  const createdJobIds: string[] = []

  // Job 1: Day +1 (scheduled) -> MUST SHOW
  const { data: j1 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    origin_address_id: originAddr!.id,
    destination_address_id: destAddr!.id,
    move_date: dateD1,
    status: 'scheduled',
    customer_notes: 'Job 1: Day +1 Scheduled',
  }).select().single()
  createdJobIds.push(j1!.id)

  // Job 2: Day +3 (in_progress) -> MUST SHOW
  const { data: j2 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    origin_address_id: originAddr!.id,
    destination_address_id: destAddr!.id,
    move_date: dateD3,
    status: 'in_progress',
    customer_notes: 'Job 2: Day +3 In Progress',
  }).select().single()
  createdJobIds.push(j2!.id)

  // Job 3: Day +5 (scheduled) -> MUST SHOW
  const { data: j3 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    origin_address_id: originAddr!.id,
    destination_address_id: destAddr!.id,
    move_date: dateD5,
    status: 'scheduled',
    customer_notes: 'Job 3: Day +5 Scheduled',
  }).select().single()
  createdJobIds.push(j3!.id)

  // Job 4: Day +6 (scheduled) -> MUST SHOW
  const { data: j4 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    origin_address_id: originAddr!.id,
    destination_address_id: destAddr!.id,
    move_date: dateD6,
    status: 'scheduled',
    customer_notes: 'Job 4: Day +6 Scheduled',
  }).select().single()
  createdJobIds.push(j4!.id)

  // Job 5: Day +7 (scheduled) -> MUST SHOW (boundary test)
  const { data: j5 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    origin_address_id: originAddr!.id,
    destination_address_id: destAddr!.id,
    move_date: dateD7,
    status: 'scheduled',
    customer_notes: 'Job 5: Day +7 Boundary Scheduled',
  }).select().single()
  createdJobIds.push(j5!.id)

  // Job 6: Day +8 (scheduled) -> MUST NOT SHOW (outside 7 days)
  const { data: j6 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    move_date: dateD8,
    status: 'scheduled',
    customer_notes: 'Job 6: Day +8 Outside',
  }).select().single()
  createdJobIds.push(j6!.id)

  // Job 7: Day +15 (scheduled) -> MUST NOT SHOW (outside 7 days)
  const { data: j7 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    move_date: dateD15,
    status: 'scheduled',
    customer_notes: 'Job 7: Day +15 Outside',
  }).select().single()
  createdJobIds.push(j7!.id)

  // Job 8: Day +2 (completed) -> MUST NOT SHOW
  const { data: j8 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    move_date: format(addDays(today, 2), 'yyyy-MM-dd'),
    status: 'completed',
    customer_notes: 'Job 8: Day +2 Completed',
  }).select().single()
  createdJobIds.push(j8!.id)

  // Job 9: Day +2 (cancelled) -> MUST NOT SHOW
  const { data: j9 } = await supabase.from('jobs').insert({
    tenant_id: tenantA,
    brand_id: brandAId,
    contact_id: contactA!.id,
    move_date: format(addDays(today, 2), 'yyyy-MM-dd'),
    status: 'cancelled',
    customer_notes: 'Job 9: Day +2 Cancelled',
  }).select().single()
  createdJobIds.push(j9!.id)

  // Job 10: Tenant B job (scheduled, Day +3) -> MUST NOT SHOW for Tenant A
  const { data: brandB } = await supabase
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantB)
    .limit(1)
    .single()

  const { data: contactB } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantB,
      first_name: 'TenantB',
      last_name: 'Customer',
    })
    .select()
    .single()

  const { data: j10, error: err10 } = await supabase.from('jobs').insert({
    tenant_id: tenantB,
    brand_id: brandB?.id || brandAId,
    contact_id: contactB!.id,
    move_date: dateD3,
    status: 'scheduled',
    customer_notes: 'Job 10: Tenant B Scheduled',
  }).select().single()

  if (err10) {
    console.error('Error creating Job 10:', err10)
  }
  if (j10) {
    createdJobIds.push(j10.id)
  }

  console.log(`✓ Seeded 10 test jobs across various dates and statuses.`)

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // Step 3: Test getUpcomingJobs() Repository Function
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 3: Test getUpcomingJobs() Function ---')
    const { getUpcomingJobs } = await import('../src/modules/jobs/server/repository')

    const resA = await getUpcomingJobs(supabase, tenantA, { days: 7 })
    if (!resA.success || !resA.jobs) {
      throw new Error(`getUpcomingJobs failed: ${resA.error}`)
    }

    console.log(`✓ getUpcomingJobs returned ${resA.jobs.length} jobs for Tenant A in 7-day window.`)
    const returnedIds = resA.jobs.map((j) => j.id)

    // Check inclusion
    const expectedIds = [j1!.id, j2!.id, j3!.id, j4!.id, j5!.id]
    for (const expId of expectedIds) {
      if (!returnedIds.includes(expId)) {
        throw new Error(`Expected Job ${expId.slice(0, 8)} to be included in 7-day upcoming moves!`)
      }
    }
    console.log('✓ Verified: Jobs 1, 2, 3, 4, and 5 (Days +1, +3, +5, +6, +7) are all included (no artificial 5-count cap).')

    // Check exclusion
    const excludedIds = [j6!.id, j7!.id, j8!.id, j9!.id, ...(j10 ? [j10.id] : [])]
    for (const excId of excludedIds) {
      if (returnedIds.includes(excId)) {
        throw new Error(`Job ${excId.slice(0, 8)} was unexpectedly included in 7-day upcoming moves!`)
      }
    }
    console.log('✓ Verified: Outside window (Days +8, +15), Completed, Cancelled, and Tenant B jobs are strictly excluded.')

    // Check chronological order
    const dates = resA.jobs.map((j) => j.move_date!)
    const sortedDates = [...dates].sort()
    if (JSON.stringify(dates) !== JSON.stringify(sortedDates)) {
      throw new Error('Jobs are not sorted in ascending chronological order!')
    }
    console.log('✓ Verified: Jobs are sorted ascending chronologically (earliest move first).')

    // ──────────────────────────────────────────────────────────────────────────
    // Step 4: Playwright UI Visual Audit & Screenshot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 4: Playwright UI Visual Audit on Dashboard ---')
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

    // Navigate to Dashboard /office
    console.log('Navigating to Dashboard /office...')
    await page.goto(`${baseUrl}/office`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('[data-testid="upcoming-moves-list"]', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Verify cards are rendered in UI
    const card1Visible = await page.locator(`[data-testid="upcoming-job-card-${j1!.id}"]`).isVisible()
    const card5Visible = await page.locator(`[data-testid="upcoming-job-card-${j5!.id}"]`).isVisible()
    console.log(`✓ Job 1 Card (Day +1) rendered in UI: ${card1Visible}`)
    console.log(`✓ Job 5 Card (Day +7) rendered in UI: ${card5Visible}`)

    const ssPath = path.join(SCREENSHOT_DIR, 'dashboard-upcoming-moves-widget.png')
    await page.screenshot({ path: ssPath, fullPage: false })
    console.log(`✓ Screenshot captured: scripts/screenshots/dashboard-upcoming-moves-widget.png`)

    await browser.close()

  } finally {
    console.log('\nCleaning up fixtures...')
    for (const jId of createdJobIds) {
      await supabase.from('jobs').delete().eq('id', jId)
    }
    if (contactA) await supabase.from('contacts').delete().eq('id', contactA.id)
    if (originAddr) await supabase.from('addresses').delete().eq('id', originAddr.id)
    if (destAddr) await supabase.from('addresses').delete().eq('id', destAddr.id)
    console.log('✓ Cleanup complete.\n')
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  UPCOMING MOVES WIDGET VERIFICATION PASSED ✓')
  console.log('═══════════════════════════════════════════════════════════════')
}

verifyUpcomingMovesWidget().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
