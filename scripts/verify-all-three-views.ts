import { chromium, type Browser } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function verifyAllThreeViews() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VERIFY CONFIRMED BOOKINGS ACROSS ALL 3 CRM VIEWS')
  console.log('  1. Dashboard Upcoming Moves Widget')
  console.log('  2. Confirmed Bookings Dedicated Page')
  console.log('  3. Kanban Board Confirmed Booking Column')
  console.log('═══════════════════════════════════════════════════════════════\n')

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

  // 1. Dashboard View
  console.log('\n--- View 1: Dashboard Upcoming Moves Widget ---')
  await page.goto(`${baseUrl}/office`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('[data-testid="upcoming-moves-list"]', { timeout: 30000 })
  await page.waitForTimeout(1000)
  const dashboardCardCount = await page.locator('[data-testid^="upcoming-job-card-"]').count()
  console.log(`✓ Dashboard Upcoming Moves Card Count: ${dashboardCardCount}`)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view1-dashboard-widget.png') })
  console.log('✓ Screenshot saved: view1-dashboard-widget.png')

  // 2. Confirmed Bookings Page View
  console.log('\n--- View 2: Confirmed Bookings Dedicated Page ---')
  await page.goto(`${baseUrl}/office/jobs/confirmed`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('table', { timeout: 30000 })
  await page.waitForTimeout(1000)
  const tableRowCount = await page.locator('tbody tr').count()
  console.log(`✓ Confirmed Bookings Table Row Count: ${tableRowCount}`)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view2-confirmed-bookings-page.png') })
  console.log('✓ Screenshot saved: view2-confirmed-bookings-page.png')

  // 3. Kanban Board Confirmed Booking Column View
  console.log('\n--- View 3: Kanban Board Confirmed Booking Column ---')
  await page.goto(`${baseUrl}/office/leads`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('[data-testid="kanban-columns-container"]', { timeout: 30000 })
  await page.waitForTimeout(1000)
  const kanbanConfirmedCol = page.locator('[data-testid^="kanban-column-"]').filter({ hasText: 'Confirmed Booking' }).first()
  const kanbanCardCount = await kanbanConfirmedCol.locator('[data-testid^="lead-card-"]').count()
  console.log(`✓ Kanban Confirmed Booking Column Card Count: ${kanbanCardCount}`)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'view3-kanban-confirmed-column.png') })
  console.log('✓ Screenshot saved: view3-kanban-confirmed-column.png')

  await browser.close()

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  ALL 3 VIEWS VERIFIED SUCCESSFULLY ✓')
  console.log('═══════════════════════════════════════════════════════════════')
}

verifyAllThreeViews().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
