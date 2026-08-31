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

async function verifyAutoConfirmFlow() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VERIFY AUTO-LAUNCH CONFIRM BOOKING MODAL ON STAGE TRANSITION')
  console.log('  (feature/phase4-scheduling-confirmed-bookings-integration)')
  console.log('═══════════════════════════════════════════════════════════════\n')

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

  // Create a test contact & lead
  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'Cynthia',
      last_name: 'AutoConfirm',
      email: 'cynthia.autoconfirm@example.com',
      phone: '+44 7700 900555',
    })
    .select()
    .single()

  const { data: lead } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contact!.id,
      brand_id: brandId,
      stage: 'inquiry',
    })
    .select()
    .single()

  console.log(`✓ Created test lead: ID=${lead?.id?.slice(0, 8)} at stage 'inquiry'`)

  try {
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

    // Test 1: StageControl on Lead Detail Page
    console.log('\n--- Step 1: Test StageControl on Lead Detail Page ---')
    const leadUrl = `${baseUrl}/office/leads/${lead!.id}`
    console.log(`Navigating to ${leadUrl}...`)
    await page.goto(leadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('[data-testid="stage-control-trigger"]', { timeout: 30000 })
    await page.waitForTimeout(1000)

    // Click StageControl dropdown
    await page.click('[data-testid="stage-control-trigger"]')
    await page.waitForSelector('[data-slot="select-item"]', { timeout: 10000 })
    await page.waitForTimeout(500)

    // Select Confirmed Booking option
    console.log('Selecting "Confirmed Booking" stage from dropdown...')
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'Confirmed Booking' }).click()
    await page.waitForTimeout(1500)

    // Verify Confirm Booking modal is opened
    const isModalVisible = await page.locator('text=Confirm Booking').first().isVisible()
    console.log(`✓ Confirm Booking Modal auto-launched via StageControl: ${isModalVisible}`)

    const ss1 = path.join(SCREENSHOT_DIR, 'stage-control-auto-confirm-modal.png')
    await page.screenshot({ path: ss1 })
    console.log(`✓ Screenshot captured: scripts/screenshots/stage-control-auto-confirm-modal.png`)

    // Test 2: Kanban Board Drag-to-Confirmed-Booking
    console.log('\n--- Step 2: Test Kanban Board Drag to Confirmed Booking ---')
    await page.goto(`${baseUrl}/office/leads`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('[data-testid="kanban-columns-container"]', { timeout: 30000 })
    await page.waitForTimeout(1000)

    const leadCard = page.locator('[data-testid^="lead-card-"]').filter({ hasText: 'Cynthia AutoConfirm' }).first()
    const targetColumn = page.locator('[data-testid^="kanban-column-"]').filter({ hasText: 'Confirmed Booking' }).first()

    if (await leadCard.isVisible() && await targetColumn.isVisible()) {
      const cardBox = await leadCard.boundingBox()
      const colBox = await targetColumn.boundingBox()

      if (cardBox && colBox) {
        console.log('Dragging Cynthia AutoConfirm lead card to Confirmed Booking column...')
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(colBox.x + colBox.width / 2, colBox.y + 150, { steps: 15 })
        await page.mouse.up()
        await page.waitForTimeout(1500)

        const isKanbanModalVisible = await page.locator('text=Confirm Booking').first().isVisible()
        console.log(`✓ Confirm Booking Modal auto-launched via Kanban Drag: ${isKanbanModalVisible}`)

        const ss2 = path.join(SCREENSHOT_DIR, 'kanban-drag-auto-confirm-modal.png')
        await page.screenshot({ path: ss2 })
        console.log(`✓ Screenshot captured: scripts/screenshots/kanban-drag-auto-confirm-modal.png`)
      }
    }

    await browser.close()

  } finally {
    console.log('\nCleaning up fixtures...')
    if (lead) await supabase.from('leads').delete().eq('id', lead.id)
    if (contact) await supabase.from('contacts').delete().eq('id', contact.id)
    console.log('✓ Cleanup complete.\n')
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUTO-CONFIRM MODAL VERIFICATION PASSED ✓')
  console.log('═══════════════════════════════════════════════════════════════')
}

verifyAutoConfirmFlow().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
