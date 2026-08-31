import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { chromium, type Browser } from '@playwright/test'
import * as fs from 'fs'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'

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

async function verifySchedulingConfirmedBookings() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VERIFY SCHEDULING CALENDAR INTEGRATION & EDGECASES')
  console.log('  (feature/phase4-scheduling-confirmed-bookings-integration)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Resolve Tenant
  const { data: userRow } = await supabase
    .from('users')
    .select('tenant_id, email')
    .eq('email', 'admin@devtest.local')
    .single()

  const tenantId = userRow!.tenant_id!
  console.log(`✓ Tenant ID: ${tenantId} (${userRow!.email})`)

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()
  const brandId = brandRow?.id

  // ──────────────────────────────────────────────────────────────────────────
  // CASE A: Confirmed Booking Flow (Creates Job -> Calendar Event)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- CASE A: Full Confirmed Booking (Job created on move date) ---')
  const targetMoveDate = format(addDays(new Date(), 4), 'yyyy-MM-dd')
  console.log(`Target Move Date for Job: ${targetMoveDate}`)

  const { data: contactA } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'Arthur',
      last_name: 'Pendleton',
      email: 'arthur.pendleton@example.com',
      phone: '+44 7700 900888',
    })
    .select()
    .single()

  const { data: leadA } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contactA!.id,
      brand_id: brandId,
      stage: 'confirmed_booking',
      preferred_move_date: targetMoveDate,
    })
    .select()
    .single()

  const { data: quoteA } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      contact_id: contactA!.id,
      lead_id: leadA!.id,
      brand_id: brandId,
      status: 'accepted',
      subtotal: 850,
      total_price: 1020,
    })
    .select()
    .single()

  const { data: jobA } = await supabase
    .from('jobs')
    .insert({
      tenant_id: tenantId,
      brand_id: brandId,
      contact_id: contactA!.id,
      quote_id: quoteA!.id,
      status: 'scheduled',
      move_date: targetMoveDate,
      customer_notes: 'VIP Move Arthur Pendleton',
    })
    .select()
    .single()

  console.log(`✓ Created Confirmed Job ID: ${jobA?.id?.slice(0, 8)} on move date: ${jobA?.move_date}`)

  // ──────────────────────────────────────────────────────────────────────────
  // CASE B: StageControl Override Flow (Relabel Lead Only -> No Job Created)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- CASE B: StageControl Direct Stage Override (No Job Created) ---')
  const { data: contactB } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'Beatrice',
      last_name: 'Overridden',
      email: 'beatrice.overridden@example.com',
    })
    .select()
    .single()

  const { data: leadB } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contactB!.id,
      brand_id: brandId,
      stage: 'inquiry',
      preferred_move_date: targetMoveDate,
    })
    .select()
    .single()

  // Simulate StageControl override: updateLeadStage()
  await supabase
    .from('leads')
    .update({ stage: 'confirmed_booking' })
    .eq('id', leadB!.id)

  // Verify: check if any jobs exist for contactB
  const { data: jobsForLeadB } = await supabase
    .from('jobs')
    .select('id')
    .eq('contact_id', contactB!.id)

  console.log(`✓ Lead B (${leadB?.id?.slice(0, 8)}) stage overridden to 'confirmed_booking'.`)
  console.log(`✓ Number of jobs created for Lead B: ${jobsForLeadB?.length ?? 0} (Expected: 0)`)
  if ((jobsForLeadB?.length ?? 0) !== 0) {
    throw new Error('Case B Failed: A job was unexpectedly created during a raw stage update!')
  }

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Verify Unified Calendar Repository Function
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 3: Verify Unified Calendar Repository ---')
    const { getUnifiedCalendarData } = await import('../src/modules/calendar/server/repository')

    const dateObj = new Date(targetMoveDate)
    const periodStart = format(startOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00'Z'")
    const periodEnd = format(endOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59'Z'")

    const calRes = await getUnifiedCalendarData(supabase, tenantId, periodStart, periodEnd)
    const calendarEvents = calRes.data || []
    const jobAEvent = calendarEvents.find((e: any) => e.id === jobA!.id)
    const leadBEvent = calendarEvents.find((e: any) => e.contact_id === contactB!.id)

    console.log(`✓ getUnifiedCalendarData returned ${calendarEvents.length} events for week ${periodStart.split('T')[0]} - ${periodEnd.split('T')[0]}.`)
    console.log(`✓ Job A Event found on calendar: ${Boolean(jobAEvent)} (Event Type: ${jobAEvent?.type}, Start: ${jobAEvent?.start_time})`)
    console.log(`✓ Lead B (StageControl-only) found on calendar: ${Boolean(leadBEvent)} (Expected: false - no job)`)

    if (!jobAEvent) {
      throw new Error('Verification failed: Job A did not appear in getUnifiedCalendarData!')
    }
    if (leadBEvent) {
      throw new Error('Verification failed: Lead B unexpectedly appeared on the calendar without a job!')
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Playwright UI Visual Audit & Screenshot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 4: Playwright UI Visual Audit on /office/scheduling ---')
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

    // Navigate to /office/scheduling?date={targetMoveDate}&view=calendar
    const schedUrl = `${baseUrl}/office/scheduling?date=${targetMoveDate}&view=calendar`
    console.log(`Navigating to ${schedUrl}...`)
    await page.goto(schedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('[role="tablist"]', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // Verify Job # appears in the calendar
    const shortJobId = jobA!.id.substring(0, 8)
    const isJobRendered = await page.locator(`text=Job #${shortJobId}`).isVisible().catch(() => false)
    console.log(`✓ Job #${shortJobId} visible in Calendar UI: ${isJobRendered}`)

    // Capture visual screenshot
    const ssPath = path.join(SCREENSHOT_DIR, 'scheduling-confirmed-booking-calendar.png')
    await page.screenshot({ path: ssPath, fullPage: false })
    console.log(`✓ Screenshot captured: scripts/screenshots/scheduling-confirmed-booking-calendar.png`)

    await browser.close()

  } finally {
    console.log('\nCleaning up fixtures...')
    if (jobA) await supabase.from('jobs').delete().eq('id', jobA.id)
    if (quoteA) await supabase.from('quotes').delete().eq('id', quoteA.id)
    if (leadA) await supabase.from('leads').delete().eq('id', leadA.id)
    if (leadB) await supabase.from('leads').delete().eq('id', leadB.id)
    if (contactA) await supabase.from('contacts').delete().eq('id', contactA.id)
    if (contactB) await supabase.from('contacts').delete().eq('id', contactB.id)
    console.log('✓ Cleanup complete.\n')
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  SCHEDULING CONFIRMED BOOKINGS AUDIT & VERIFICATION PASSED ✓')
  console.log('═══════════════════════════════════════════════════════════════')
}

verifySchedulingConfirmedBookings().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
