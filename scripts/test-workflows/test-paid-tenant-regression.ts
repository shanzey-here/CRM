import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const SHOT_DIR = 'D:/CRM/scripts/test-workflows'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)

  await page.goto(`${BASE}/office/workflows`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const listBody = await page.locator('body').textContent()
  console.log('=== Paid tenant: list page ===')
  console.log('Shows preview-mode banner (should be FALSE):', listBody?.includes("You're exploring Workflows in preview mode"))
  await page.screenshot({ path: `${SHOT_DIR}/6-paid-tenant-list.png`, fullPage: true })

  await page.locator('a[href="/office/workflows/new"]').click({ force: true })
  await page.waitForTimeout(2000)
  if (!page.url().includes('/office/workflows/new')) {
    console.log('First click did not navigate, retrying...')
    await page.goto(`${BASE}/office/workflows/new`, { waitUntil: 'networkidle' })
  }
  await page.waitForTimeout(4000)

  await page.fill('#name', 'Paid tenant regression test workflow')
  await page.locator('input[placeholder="e.g. Call customer"]').fill('Regression check task')
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: /Save Workflow/i }).click()
  await page.waitForTimeout(6000)

  console.log('\n=== Paid tenant: after save attempt ===')
  console.log('URL after save (should have redirected to /office/workflows):', page.url())
  const afterBody = await page.locator('body').textContent()
  console.log('Shows "Upgrade to save" (should be FALSE):', afterBody?.includes('Upgrade to save'))
  console.log('Shows the new workflow in the list:', afterBody?.includes('Paid tenant regression test workflow'))
  await page.screenshot({ path: `${SHOT_DIR}/7-paid-tenant-saved.png`, fullPage: true })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
