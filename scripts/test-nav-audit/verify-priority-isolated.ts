import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST') {
      const body = await res.text().catch((e) => `(failed to read body: ${e})`)
      netLog.push(`POST ${res.url()} -> status=${res.status()} body=${body.slice(0, 600)}`)
    }
  })
  page.on('request', (req) => {
    if (req.method() === 'POST') {
      netLog.push(`>> requesting POST ${req.url()}`)
    }
  })
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push('[pageerror] ' + err.message))
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push('[console.error] ' + msg.text()) })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  await page.goto(`${BASE}/office/leads/${LEAD_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  await page.click('text=Edit Details')
  await page.waitForTimeout(800)
  await page.click('button:has-text("Medium")')
  await page.waitForTimeout(400)
  await page.click('[role="option"]:has-text("High")')
  await page.waitForTimeout(600)

  const dialogTextBeforeSave = await page.locator('[role="dialog"]').textContent()
  console.log('Dialog state before Save click:', dialogTextBeforeSave?.replace(/\s+/g, ' '))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/priority-before-save.png' })

  const saveButton = page.locator('[role="dialog"] button:has-text("Save Changes")')
  console.log('Save button visible:', await saveButton.isVisible())
  console.log('Save button enabled:', await saveButton.isEnabled())

  netLog.length = 0
  consoleErrors.length = 0
  await saveButton.click({ force: false })
  await page.waitForTimeout(20000)
  console.log('Network:', JSON.stringify(netLog, null, 2))
  console.log('Console/page errors:', JSON.stringify(consoleErrors))

  const dialogCount = await page.locator('[role="dialog"]').count()
  console.log('Dialog still open:', dialogCount)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyText = await page.locator('body').textContent()
  console.log('Header shows "High Priority" badge:', bodyText?.includes('High Priority'))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
