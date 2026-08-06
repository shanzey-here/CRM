import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads/d292cd7a-576c-417c-8dee-9350bff59e67`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.click('text=Edit Details')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/quick-dialog-check.png' })
  const dialogText = await page.locator('[role="dialog"]').textContent().catch(() => '(no dialog)')
  console.log('Dialog text:', dialogText)
  console.log('Errors:', JSON.stringify(errors))
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
