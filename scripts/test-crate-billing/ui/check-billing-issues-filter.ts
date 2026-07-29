import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)

  await page.goto(`${BASE}/login`)
  await page.waitForSelector('#email')
  await page.fill('#email', 'admin@devtest.local')
  await page.fill('#password', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

  await page.goto(`${BASE}/office/storage?billing_issues=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Billing issues')
  await page.waitForTimeout(1000)

  const body = await page.locator('body').innerText()
  console.log('Shows the BILLING-TEST-OVERDUE crate (has a real failed charge)?', body.includes('BILLING-TEST-OVERDUE'))
  console.log('Shows the BILLING-TEST-NOCARD crate (has a real failed charge)?', body.includes('BILLING-TEST-NOCARD'))
  await page.screenshot({ path: 'scripts/test-crate-billing/ui/screenshots/billing-issues-filter.png', fullPage: true })

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
