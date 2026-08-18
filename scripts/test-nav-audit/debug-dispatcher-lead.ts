import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(60000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'dispatcher@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads/d292cd7a-576c-417c-8dee-9350bff59e67`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  console.log('URL:', page.url())
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug-dispatcher-lead.png' })
  const bodyText = await page.locator('body').textContent()
  console.log('Has "Edit Details":', bodyText?.includes('Edit Details'))
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
