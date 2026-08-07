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

  await page.locator('a[href*="/office/workflows/new?template="]').first().click({ force: true })
  await page.waitForTimeout(3000)
  console.log('URL:', page.url())
  const nameValue = await page.locator('#name').inputValue()
  console.log('Workflow name pre-filled from template:', nameValue)
  const bodyText = await page.locator('body').textContent()
  console.log('Contains upgrade banner still (should NOT show, since form itself has no banner, only list page does):', bodyText?.includes("exploring Workflows in preview mode"))
  await page.screenshot({ path: 'D:/CRM/scripts/test-workflows/5-template-loaded.png', fullPage: true })
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
