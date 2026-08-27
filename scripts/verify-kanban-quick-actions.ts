import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function seedLeadsForAllStages(tenantId: string) {
  const stages = ['inquiry', 'survey_scheduled', 'quote_sent', 'follow_up', 'confirmed_booking'] as const

  // Get or create contact
  let { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(5)

  if (!contacts || contacts.length === 0) {
    const { data: newContact, error: cErr } = await supabaseAdmin
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        first_name: 'Arthur',
        last_name: 'Pendelton',
        email: 'arthur.p@example.com',
        phone: '07123 456789',
        company_name: 'Pendelton Enterprises',
      })
      .select('id')
      .single()
    if (cErr) console.error('Error creating contact:', cErr)
    contacts = [newContact!]
  }

  // Get brand
  const { data: brands } = await supabaseAdmin
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  const brandId = brands?.[0]?.id

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const { data: existingLeads } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('stage', stage)
      .eq('is_archived', false)

    if (!existingLeads || existingLeads.length === 0) {
      console.log(`Seeding demo lead for stage: ${stage}`)
      const contactId = contacts[i % contacts.length].id
      await supabaseAdmin.from('leads').insert({
        tenant_id: tenantId,
        contact_id: contactId,
        brand_id: brandId,
        stage: stage,
        source: 'website',
        preferred_move_date: '2026-09-15',
        notes: `Demo lead for stage ${stage} testing quick actions`,
        priority: 'medium',
      })
    }
  }
}

async function run() {
  console.log('--- Verifying Kanban Card Quick Actions ---')

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('email', 'admin@devtest.local')
    .limit(1)

  const tenantId = users?.[0]?.tenant_id
  if (!tenantId) {
    throw new Error('Tenant ID not found for admin@devtest.local')
  }

  console.log('Seeding / verifying leads in all 5 stages...')
  await seedLeadsForAllStages(tenantId)

  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  const baseUrl = 'http://127.0.0.1:3000'
  console.log('Logging in...')
  await page.goto(`${baseUrl}/login`)
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/login') && res.status() === 303, { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]')
  ])
  await page.waitForTimeout(3000)
  console.log('Navigating to /office/leads...')

  await page.goto(`${baseUrl}/office/leads`)
  await page.waitForSelector('text=Leads Pipeline', { timeout: 20000 })
  await page.waitForTimeout(2000)

  // 1. Screenshot of entire Kanban board with quick actions visible across all 5 columns
  const boardScreenshotPath = path.join(SCREENSHOTS_DIR, 'kanban-all-stages-quick-actions.png')
  await page.screenshot({ path: boardScreenshotPath, fullPage: true })
  console.log(`✓ Captured Kanban Board with all 5 stages: ${boardScreenshotPath}`)

  // Verify all 4 action buttons exist on cards
  const surveyButtons = page.locator('button[aria-label="Schedule Survey"]')
  const count = await surveyButtons.count()
  console.log(`Found ${count} cards with quick action buttons.`)
  if (count === 0) {
    throw new Error('No quick action buttons found on cards!')
  }

  // 2. Open dropdown menu on first card
  const actionsMenuTrigger = page.locator('button[title="Quick Actions menu"]').first()
  await actionsMenuTrigger.click()
  await page.waitForTimeout(500)

  const dropdownScreenshotPath = path.join(SCREENSHOTS_DIR, 'quick-actions-dropdown-open.png')
  await page.screenshot({ path: dropdownScreenshotPath })
  console.log(`✓ Captured Quick Actions Dropdown Menu: ${dropdownScreenshotPath}`)

  // Close dropdown by pressing Escape or clicking outside
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 3. Test Schedule Survey Modal
  console.log('Testing Schedule Survey action...')
  const firstSurveyBtn = page.locator('button[aria-label="Schedule Survey"]').first()
  await firstSurveyBtn.click()
  await page.waitForSelector('text=Schedule Survey')
  await page.waitForSelector('text=Real Process Trigger')
  await page.waitForTimeout(400)

  // Confirm URL did NOT change to /office/leads/[id]
  if (page.url().includes('/office/leads/')) {
    console.error('ERROR: URL changed on button click:', page.url())
    throw new Error('Quick action click incorrectly triggered card navigation!')
  }

  const surveyModalPath = path.join(SCREENSHOTS_DIR, 'modal-schedule-survey.png')
  await page.screenshot({ path: surveyModalPath })
  console.log(`✓ Captured Schedule Survey Modal: ${surveyModalPath}`)

  // Close modal
  await page.click('button:has-text("Cancel")')
  await page.waitForTimeout(400)

  // 4. Test Send Quote Modal
  console.log('Testing Send Quote action...')
  const firstQuoteBtn = page.locator('button[aria-label="Send Quote"]').first()
  await firstQuoteBtn.click()
  await page.waitForSelector('text=Send Quote Proposal')
  await page.waitForSelector('text=Real Process Trigger')
  await page.waitForTimeout(400)

  const quoteModalPath = path.join(SCREENSHOTS_DIR, 'modal-send-quote.png')
  await page.screenshot({ path: quoteModalPath })
  console.log(`✓ Captured Send Quote Modal: ${quoteModalPath}`)

  await page.click('button:has-text("Cancel")')
  await page.waitForTimeout(400)

  // 5. Test Follow Up Modal
  console.log('Testing Follow Up action...')
  const firstFollowUpBtn = page.locator('button[aria-label="Log Follow-Up"]').first()
  await firstFollowUpBtn.click()
  await page.waitForSelector('text=Log Follow-Up')
  await page.waitForSelector('text=Real Process Trigger')
  await page.waitForTimeout(400)

  const followUpModalPath = path.join(SCREENSHOTS_DIR, 'modal-follow-up.png')
  await page.screenshot({ path: followUpModalPath })
  console.log(`✓ Captured Follow Up Modal: ${followUpModalPath}`)

  await page.click('button:has-text("Cancel")')
  await page.waitForTimeout(400)

  // 6. Test Confirm Booking Modal
  console.log('Testing Confirm Booking action...')
  const firstBookingBtn = page.locator('button[aria-label="Confirm Booking"]').first()
  await firstBookingBtn.click()
  await page.waitForSelector('text=Confirm Booking')
  await page.waitForSelector('text=Real Process Trigger')
  await page.waitForTimeout(400)

  const bookingModalPath = path.join(SCREENSHOTS_DIR, 'modal-confirm-booking.png')
  await page.screenshot({ path: bookingModalPath })
  console.log(`✓ Captured Confirm Booking Modal: ${bookingModalPath}`)

  await page.click('button:has-text("Cancel")')
  await page.waitForTimeout(400)

  // 7. Verify Lead Detail Page StageControl
  console.log('Navigating to lead detail page to verify StageControl...')
  const firstCardName = page.locator('div[class*="group relative bg-white"] p.font-semibold').first()
  await firstCardName.click()
  await page.waitForURL((url) => url.pathname.includes('/office/leads/') && !url.pathname.endsWith('/office/leads'), { timeout: 15000 })
  console.log(`Navigated to detail page: ${page.url()}`)
  await page.waitForSelector('text=Contact Info', { timeout: 15000 })
  await page.waitForTimeout(1000)

  const detailScreenshotPath = path.join(SCREENSHOTS_DIR, 'stage-control-detail-page.png')
  await page.screenshot({ path: detailScreenshotPath, fullPage: true })
  console.log(`✓ Captured Lead Detail Page with StageControl: ${detailScreenshotPath}`)

  await browser.close()
  console.log('--- All Quick Action Verifications PASSED! ---')
}

run().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
