import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(90000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'dispatcher@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  console.log('======= Dispatcher: Lead priority edit =======')
  await page.goto(`${BASE}/office/leads/${LEAD_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.click('text=Edit Details')
  await page.waitForTimeout(800)
  await page.click('button:has-text("Medium")')
  await page.waitForTimeout(400)
  await page.click('[role="option"]:has-text("Low")')
  await page.waitForTimeout(400)
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(15000)
  const dialogOpen = await page.locator('[role="dialog"]').count()
  console.log('Dialog closed after save (0 = success):', dialogOpen)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyText = await page.locator('body').textContent()
  console.log('Lead Info shows priority "low":', /Priority\s*low/i.test(bodyText?.replace(/\s+/g, ' ') || ''))

  console.log('\n======= Dispatcher: Job Special Instructions edit =======')
  await page.goto(`${BASE}/office/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.click('text=Edit Notes')
  await page.waitForTimeout(600)
  await page.fill('#internal_notes', 'Dispatcher edit test — updated instructions.')
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(15000)
  const jobDialogOpen = await page.locator('[role="dialog"]').count()
  console.log('Job dialog closed after save (0 = success):', jobDialogOpen)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const jobBodyText = await page.locator('body').textContent()
  console.log('Job page shows dispatcher-edited text:', jobBodyText?.includes('Dispatcher edit test'))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
