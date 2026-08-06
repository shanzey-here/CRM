import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(60000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const bodyText = await page.locator('body').textContent()
  console.log('Shows fallback "wasn\'t created" message:', bodyText?.includes("wasn't created"))
  console.log('Shows "Generate Summary" button:', bodyText?.includes('Generate Summary'))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/fallback-ui.png' })
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
