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

  console.log('======= Priority + Assigned To =======')
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

  const dialogTextBeforeSubmit = await page.locator('[role="dialog"]').textContent()
  console.log('Dialog state right before submit:', dialogTextBeforeSubmit?.replace(/\s+/g, ' '))

  netLog.length = 0
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(15000)

  console.log('Network during save:', JSON.stringify(netLog, null, 2))
  console.log('Console/page errors during save:', JSON.stringify(consoleErrors))

  const dialogStillOpen = await page.locator('[role="dialog"]').count()
  console.log('Dialog still open after save (should be 0 = closed = success):', dialogStillOpen)
  if (dialogStillOpen > 0) {
    const dialogTextAfter = await page.locator('[role="dialog"]').textContent()
    console.log('Dialog text after failed save (look for error message):', dialogTextAfter?.replace(/\s+/g, ' '))
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyText1 = await page.locator('body').textContent()
  console.log('Header shows "High Priority" badge:', bodyText1?.includes('High Priority'))
  console.log('Lead Info priority section shows "high":', /Priority\s*high/i.test(bodyText1?.replace(/\s+/g, ' ') || ''))
  console.log('Contains "Dispatcher (Dev)" (assigned_to):', bodyText1?.includes('Dispatcher (Dev)'))

  console.log('\n======= Contact preferences =======')
  await page.click('text=Edit Profile')
  await page.waitForTimeout(800)
  await page.click('button:has-text("Not set")')
  await page.waitForTimeout(400)
  await page.click('[role="option"]:has-text("Text")')
  await page.waitForTimeout(400)
  await page.fill('#best_time_to_call', 'Weekday evenings after 6pm')
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(15000)

  const contactDialogStillOpen = await page.locator('[role="dialog"]').count()
  console.log('Contact dialog still open after save (should be 0):', contactDialogStillOpen)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyText2 = await page.locator('body').textContent()
  console.log('Shows "Preferred Contact Method":', bodyText2?.includes('Preferred Contact Method'))
  console.log('Shows "Text" value near it:', /Preferred Contact Method\s*Text/i.test(bodyText2?.replace(/\s+/g, ' ') || ''))
  console.log('Shows "Weekday evenings after 6pm":', bodyText2?.includes('Weekday evenings after 6pm'))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/lead-fields-final.png', fullPage: true })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
