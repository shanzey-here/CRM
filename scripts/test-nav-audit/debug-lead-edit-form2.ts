import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(30000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().endsWith(`/office/leads/${LEAD_ID}`)) {
      const body = await res.text().catch(() => '')
      netLog.push(`status=${res.status()} body=${body.slice(0, 500)}`)
    }
  })

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

  console.log('--- Step 1: open priority dropdown ---')
  await page.click('button:has-text("medium")')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug2-priority-open.png' })
  const priorityOpts = await page.locator('[role="option"]').allTextContents()
  console.log('Options visible with only priority open:', JSON.stringify(priorityOpts))

  console.log('\n--- Step 2: click High ---')
  await page.click('[role="option"]:has-text("High")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug2-after-high-click.png' })
  const dialogTextAfterPriority = await page.locator('[role="dialog"]').textContent()
  console.log('Dialog text after selecting High:', dialogTextAfterPriority?.replace(/\s+/g, ' '))

  console.log('\n--- Step 3: open assigned_to dropdown ---')
  await page.click('button:has-text("unassigned")')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug2-assignedto-open.png' })
  const assignOpts = await page.locator('[role="option"]').allTextContents()
  console.log('Options visible with only assigned_to open:', JSON.stringify(assignOpts))

  console.log('\n--- Step 4: click Dispatcher (Dev) ---')
  await page.click('[role="option"]:has-text("Dispatcher (Dev)")')
  await page.waitForTimeout(500)
  const dialogTextAfterAssign = await page.locator('[role="dialog"]').textContent()
  console.log('Dialog text after selecting assignee:', dialogTextAfterAssign?.replace(/\s+/g, ' '))

  console.log('\n--- Step 5: submit ---')
  netLog.length = 0
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(2500)
  console.log('Network:', JSON.stringify(netLog))

  const dialogStillOpen = await page.locator('[role="dialog"]').count()
  console.log('Dialog still open after save:', dialogStillOpen > 0)
  if (dialogStillOpen > 0) {
    const finalDialogText = await page.locator('[role="dialog"]').textContent()
    console.log('Final dialog text:', finalDialogText?.replace(/\s+/g, ' '))
  }

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug2-after-submit.png' })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
