import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(30000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin-freetier@workflowtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/office/workflows`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const html = await page.locator('a[href="/office/workflows/new"]').evaluate((el) => el.outerHTML).catch((e) => 'ERROR: ' + e.message)
  console.log('Anchor outerHTML:', html)

  // Try navigating by direct href evaluation
  const href = await page.locator('a[href="/office/workflows/new"]').getAttribute('href').catch(() => null)
  console.log('href attr:', href)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
