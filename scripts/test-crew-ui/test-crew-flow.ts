import { chromium, devices } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'
const SHOT_DIR = 'D:/CRM/scripts/test-crew-ui'

async function main() {
  const iPhone = devices['iPhone 13']
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ ...iPhone })
  const page = await context.newPage()
  page.setDefaultTimeout(120000)

  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('hydrated')) consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  console.log('Viewport:', JSON.stringify(iPhone.viewport))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'crew@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  console.log('Logged in. URL after login:', page.url())

  // === STEP 1: Jobs list ===
  await page.goto(`${BASE}/crew`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(15000)
  await page.screenshot({ path: `${SHOT_DIR}/1-jobs-list-mobile.png`, fullPage: true })
  const listBody = await page.locator('body').textContent()
  console.log('Jobs list shows "Last synced":', listBody?.includes('Last synced') || listBody?.includes('Never synced'))

  // === STEP 2: Job detail / run sheet ===
  await page.goto(`${BASE}/crew/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(20000)
  await page.screenshot({ path: `${SHOT_DIR}/2-job-detail-mobile.png`, fullPage: true })
  console.log('Job detail URL:', page.url())

  console.log('\nConsole errors so far:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
