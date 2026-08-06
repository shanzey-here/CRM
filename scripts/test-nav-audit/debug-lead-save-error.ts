import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(60000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes(`/office/leads/${LEAD_ID}`)) {
      const body = await res.text().catch(() => '')
      netLog.push(`status=${res.status()} body=${body.slice(0, 800)}`)
    }
  })
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(err.message))
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

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
  await page.waitForTimeout(400)
  await page.click('button:has-text("Unassigned")')
  await page.waitForTimeout(400)
  await page.click('[role="option"]:has-text("Dispatcher (Dev)")')
  await page.waitForTimeout(400)

  netLog.length = 0
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(3000)

  console.log('Network:', JSON.stringify(netLog, null, 2))
  console.log('Console/page errors:', JSON.stringify(consoleErrors))

  const dialogText = await page.locator('[role="dialog"]').textContent().catch(() => '(dialog closed)')
  console.log('Dialog text after save attempt:', dialogText)

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug-save-error.png' })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
