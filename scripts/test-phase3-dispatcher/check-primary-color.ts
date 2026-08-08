import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(90000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const primaryVal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim())
  console.log('Computed --color-primary:', primaryVal)

  const dashboardLink = page.locator('a:has-text("Dashboard")').first()
  const iconColor = await dashboardLink.locator('svg').evaluate((el) => getComputedStyle(el).color)
  console.log('Active Dashboard nav icon color (computed):', iconColor)

  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/00-dashboard-current.png', fullPage: true })
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
