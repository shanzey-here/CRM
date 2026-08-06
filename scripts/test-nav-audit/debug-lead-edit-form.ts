import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(30000)

  const errors: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(err.message))

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

  console.log('Clicking Edit Details...')
  await page.click('text=Edit Details')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug-lead-1-dialog-open.png' })

  // Dump the dialog's visible text so I can see the real current Select labels
  const dialogText = await page.locator('[role="dialog"]').textContent().catch(() => '(no dialog found)')
  console.log('Dialog text:', dialogText)

  console.log('\nClicking priority select trigger...')
  const prioritySelects = await page.locator('[role="dialog"] button').allTextContents()
  console.log('All buttons in dialog:', JSON.stringify(prioritySelects))

  await browser.close()
  console.log('\nConsole/page errors:', JSON.stringify(errors))
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
