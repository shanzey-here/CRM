import { chromium } from 'playwright'

const TEST_DATE = '2026-08-15'
const BASE_URL = 'http://localhost:3000'

async function runTest() {
  console.log('--- Starting Calendar UI Verification ---')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // 1. Auth
    console.log('Authenticating...')
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'admin@devtest.local')
    await page.fill('input[type="password"]', 'DevTest123!')
    await page.click('button[type="submit"]')
    await page.waitForNavigation()
    
    // 2. Filters
    console.log('Testing Filters...')
    await page.goto(`${BASE_URL}/office/scheduling?date=${TEST_DATE}&view=calendar&range=week`)
    await page.waitForSelector('.bg-slate-200, .bg-blue-100, .bg-amber-100')
    const jobsCheckbox = page.locator('label:has-text("Jobs") input[type="checkbox"]')
    await jobsCheckbox.click()
    await page.waitForURL(/type=/)
    console.log('Verified URL updated for filters.')

    // 3. Date Navigation
    console.log('Testing Date Navigation...')
    await page.locator('button:has(svg.lucide-chevron-right)').click()
    await page.waitForURL(/date=/)
    console.log('Verified Date next.')
    await page.getByRole('button', { name: 'Day', exact: true }).click()
    await page.waitForSelector('.grid-cols-2')
    console.log('Verified Day view toggle.')
    
    // 4. Detail View
    console.log('Testing Detail Modal...')
    await page.goto(`${BASE_URL}/office/scheduling?date=${TEST_DATE}&view=calendar&range=week`)
    await page.waitForSelector('.bg-slate-200, .bg-blue-100, .bg-amber-100')
    const eventLocator = page.locator('.bg-slate-200, .bg-blue-100, .bg-amber-100').first()
    await eventLocator.click()
    
    const dialog = page.locator('[role="dialog"]')
    await dialog.waitFor()
    console.log('Verified Detail Modal opens.')

    // Wait for the select
    const statusSelect = dialog.locator('button[role="combobox"]')
    await statusSelect.waitFor()
    console.log('Verified Status Select exists.')

    console.log('✅ All UI interactions verified successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

runTest()
