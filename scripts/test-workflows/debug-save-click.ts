import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(30000)
  page.on('console', (m) => console.log('[console]', m.type(), m.text()))
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  page.on('requestfinished', (r) => {
    if (r.method() === 'POST') console.log('[POST]', r.url())
  })

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

  await page.fill('#name', 'Debug save test')
  await page.locator('input[placeholder="e.g. Call customer"]').fill('Debug task title')
  await page.waitForTimeout(500)

  const saveBtn = page.getByRole('button', { name: /Save Workflow/i })
  console.log('Save button count:', await saveBtn.count())
  console.log('Save button visible:', await saveBtn.isVisible())
  console.log('Save button enabled:', await saveBtn.isEnabled())

  await saveBtn.click()
  console.log('Clicked. Waiting...')
  await page.waitForTimeout(6000)

  const bodyText = await page.locator('body').textContent()
  console.log('Contains "Upgrade to save":', bodyText?.includes('Upgrade to save'))
  console.log('Contains "Error":', bodyText?.includes('Error'))
  console.log('URL:', page.url())

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
