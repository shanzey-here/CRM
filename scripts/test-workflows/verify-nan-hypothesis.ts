import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(30000)
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('workflows')) console.log('[POST]', r.url()) })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin-freetier@workflowtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/office/workflows/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  await page.fill('#name', 'NaN hypothesis test')
  await page.locator('input[placeholder="e.g. Call customer"]').fill('Task title')
  // Explicitly fill the Due Offset (Days) field this time
  await page.locator('input[placeholder="e.g. 2"]').fill('3')
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: /Save Workflow/i }).click()
  await page.waitForTimeout(5000)

  const bodyText = await page.locator('body').textContent()
  console.log('Contains "Upgrade to save":', bodyText?.includes('Upgrade to save'))
  console.log('URL:', page.url())

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
