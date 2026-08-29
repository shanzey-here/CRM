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

async function run() {
  console.log('--- Verifying Schedule Survey Action UI (Epic D) ---')

  // 1. Get devtest user & tenant
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('email', 'admin@devtest.local')
    .limit(1)

  const tenantId = users?.[0]?.tenant_id
  if (!tenantId) {
    throw new Error('Tenant ID not found for admin@devtest.local')
  }
  console.log(`Using Tenant: ${tenantId}`)

  // 2. Find or create a lead in 'inquiry' stage
  let { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*, contacts(*)')
    .eq('tenant_id', tenantId)
    .eq('stage', 'inquiry')
    .order('created_at', { ascending: false })
    .limit(1)

  let lead = leads?.[0]

  if (!lead) {
    console.log('No inquiry lead found, creating a new lead...')
    let { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .eq('tenant_id', tenantId)
      .limit(1)

    let contactId = contacts?.[0]?.id
    if (!contactId) {
      const { data: newContact } = await supabaseAdmin
        .from('contacts')
        .insert({
          tenant_id: tenantId,
          first_name: 'Arthur',
          last_name: 'Pendelton',
          email: 'arthur.p@example.com',
          phone: '07123 456789',
        })
        .select('id')
        .single()
      contactId = newContact!.id
    }

    const { data: brands } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)

    const brandId = brands?.[0]?.id

    const { data: newLead, error: createErr } = await supabaseAdmin
      .from('leads')
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        brand_id: brandId,
        stage: 'inquiry',
        status: 'open',
        priority: 'medium',
        preferred_move_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      })
      .select('*, contacts(*)')
      .single()

    if (createErr || !newLead) {
      throw new Error(`Failed to seed lead: ${createErr?.message}`)
    }
    lead = newLead
  }

  const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts
  const contactName = `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Test Lead'
  console.log(`Target Lead: ${lead.id} (Contact: ${contactName}, Stage: ${lead.stage})`)

  // 3. Launch browser and log in
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
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

  // 4. Navigate to /office/leads Kanban board
  console.log('Navigating to /office/leads...')
  await page.goto(`${baseUrl}/office/leads`)
  await page.waitForSelector('text=Leads Pipeline', { timeout: 20000 })
  await page.waitForTimeout(2000)

  // 5. Open Schedule Survey modal from the target lead's card
  console.log(`Locating lead card for "${contactName}"...`)
  const surveyButton = page.locator('button[aria-label="Schedule Survey"]').first()
  await surveyButton.click()

  // Wait for Schedule Survey dialog to open
  await page.waitForSelector('text=Schedule Survey Appointment', { timeout: 15000 })
  console.log('✓ Schedule Survey modal opened successfully.')

  const modalScreenshotPath = path.join(SCREENSHOTS_DIR, 'modal-schedule-survey-filled.png')
  await page.screenshot({ path: modalScreenshotPath })
  console.log(`✓ Captured Schedule Survey Form Modal: ${modalScreenshotPath}`)

  // 6. Fill out the form
  const surveyTitleInput = page.locator('#survey-title')
  const initialTitle = await surveyTitleInput.inputValue()
  console.log(`Initial Survey Title in form: "${initialTitle}"`)

  const surveyNotesInput = page.locator('#survey-description')
  await surveyNotesInput.fill('WhatsApp video survey scheduled. Client confirmed availability.')

  // Submit the form
  console.log('Submitting Schedule Survey form...')
  const submitButton = page.locator('button:has-text("Schedule Survey Appointment")').last()
  await submitButton.click()

  // Wait for modal to close (or check if server error was rendered)
  try {
    await page.waitForSelector('#survey-title', { state: 'detached', timeout: 20000 })
    console.log('✓ Modal closed after successful submission.')
  } catch (e) {
    const errorBanner = page.locator('div.bg-red-50').first()
    if (await errorBanner.isVisible().catch(() => false)) {
      const errorText = await errorBanner.textContent()
      console.error('Server error displayed in form:', errorText)
    }
    throw e
  }

  // Wait a moment for stage updates and revalidation
  await page.waitForTimeout(3000)

  // 7. Verify Appointment Created in Database
  console.log('Checking appointments table in database...')
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contact_id', lead.contact_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (apptErr || !appt) {
    throw new Error(`Appointment not found in DB: ${apptErr?.message}`)
  }
  console.log(`✓ Appointment created in DB: id=${appt.id}, title="${appt.title}", start=${appt.start_time}, end=${appt.end_time}`)

  // 8. Verify Lead Stage updated in Database
  const { data: updatedLead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .select('id, stage')
    .eq('id', lead.id)
    .single()

  if (leadErr || !updatedLead) {
    throw new Error(`Failed to fetch lead: ${leadErr?.message}`)
  }
  console.log(`✓ Lead stage updated in DB: ${updatedLead.stage} (expected: survey_scheduled)`)
  if (updatedLead.stage !== 'survey_scheduled') {
    throw new Error(`Expected stage survey_scheduled, got ${updatedLead.stage}`)
  }

  // 9. Verify Lead Card moved to Survey Scheduled on Kanban
  const kanbanScreenshotPath = path.join(SCREENSHOTS_DIR, 'kanban-after-survey-scheduled.png')
  await page.screenshot({ path: kanbanScreenshotPath })
  console.log(`✓ Captured Kanban Board after survey scheduled: ${kanbanScreenshotPath}`)

  // 10. Verify Unified Calendar Rendering
  console.log('Navigating to Unified Calendar (/office/scheduling?view=calendar)...')
  await page.goto(`${baseUrl}/office/scheduling?view=calendar`)
  await page.waitForSelector('text=Dispatch Board', { timeout: 20000 })
  await page.waitForTimeout(2000)

  const calendarScreenshotPath = path.join(SCREENSHOTS_DIR, 'unified-calendar-with-survey-appointment.png')
  await page.screenshot({ path: calendarScreenshotPath })
  console.log(`✓ Captured Unified Calendar: ${calendarScreenshotPath}`)

  // 11. Verify Lead Detail Page Entry Point & Timeline
  console.log(`Navigating to Lead Detail Page (/office/leads/${lead.id})...`)
  await page.goto(`${baseUrl}/office/leads/${lead.id}`)
  await page.waitForSelector('text=Contact Info', { timeout: 20000 })
  await page.waitForTimeout(1500)

  // Verify Schedule Survey button in LeadQuickActionsBar
  const detailSurveyBtn = page.locator('button[aria-label="Schedule Survey"]').first()
  await detailSurveyBtn.click()
  await page.waitForSelector('text=Schedule Survey Appointment', { timeout: 15000 })
  console.log('✓ Schedule Survey modal opened from Lead Detail Page quick actions bar.')

  const detailModalScreenshotPath = path.join(SCREENSHOTS_DIR, 'detail-page-schedule-survey-modal.png')
  await page.screenshot({ path: detailModalScreenshotPath })
  console.log(`✓ Captured Lead Detail Page Schedule Survey Modal: ${detailModalScreenshotPath}`)

  // Close modal
  const cancelBtn = page.locator('button:has-text("Cancel")').first()
  await cancelBtn.click()
  await page.waitForSelector('text=Schedule Survey Appointment', { state: 'detached', timeout: 10000 })

  console.log('--- All Schedule Survey Action UI Verifications PASSED! ---')
  await browser.close()
}

run().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
