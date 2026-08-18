import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const OTHER_TENANT_WORKFLOW_ID = 'af7d08af-29c2-48ac-bd03-20c65f8a0092' // belongs to dev tenant (paid), not the free-tier tenant

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

  const response = await page.goto(`${BASE}/office/workflows/${OTHER_TENANT_WORKFLOW_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  console.log('HTTP status:', response?.status())
  const bodyText = await page.locator('body').textContent()
  console.log('Shows the other tenant\'s real workflow name (should be FALSE):', bodyText?.includes('Paid tenant regression test workflow'))
  console.log('Shows 404/not-found style content:', bodyText?.toLowerCase().includes('404') || bodyText?.toLowerCase().includes('not found'))
  await page.screenshot({ path: 'D:/CRM/scripts/test-workflows/8-cross-tenant-blocked.png', fullPage: true })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
