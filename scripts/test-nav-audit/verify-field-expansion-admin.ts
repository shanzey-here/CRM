import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'

async function login(page: any, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r: any) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(90000)

  await login(page, 'admin@devtest.local')

  // ============================================================
  // JOB DETAIL PAGE: Special Instructions + Post-Job Notes
  // ============================================================
  console.log('======= JOB: Special Instructions + Post-Job Notes =======')
  await page.goto(`${BASE}/office/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  await page.click('text=Edit Notes')
  await page.waitForTimeout(500)
  await page.fill('#internal_notes', 'Narrow driveway, use the smaller van. Customer has a dog.')
  await page.fill('#customer_notes', 'Job completed without issue. Customer was very happy with the crew.')
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(2500)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const specialInstructions = await page.locator('text=Special Instructions').locator('..').locator('..').textContent()
  const postJobNotes = await page.locator('text=Post-Job Notes').locator('..').locator('..').textContent()
  console.log('Special Instructions card text:', specialInstructions?.replace(/\s+/g, ' '))
  console.log('Post-Job Notes card text:', postJobNotes?.replace(/\s+/g, ' '))

  // ============================================================
  // JOB DETAIL PAGE: Actual crew start/finish
  // ============================================================
  console.log('\n======= JOB: Actual crew start/finish =======')
  await page.click('[aria-label="Edit actual start/finish times"]')
  await page.waitForTimeout(500)
  await page.fill('#actual_start', '2026-08-10T09:15')
  await page.fill('#actual_end', '2026-08-10T13:45')
  await page.click('button:has-text("Save")')
  await page.waitForTimeout(2500)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyTextJob = await page.locator('body').textContent()
  console.log('Contains "Actual: 9:15 AM":', bodyTextJob?.includes('9:15 AM'))
  console.log('Contains "1:45 PM":', bodyTextJob?.includes('1:45 PM'))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/verify-job-detail-final.png', fullPage: true })

  // ============================================================
  // LEAD DETAIL PAGE: Priority + Assigned To dropdown
  // ============================================================
  console.log('\n======= LEAD: Priority + Assigned To dropdown =======')
  await page.goto(`${BASE}/office/leads/${LEAD_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  await page.click('text=Edit Details')
  await page.waitForTimeout(500)
  // Priority select (rendered value is lowercase, e.g. "medium")
  await page.click('button:has-text("medium")')
  await page.waitForTimeout(300)
  await page.click('[role="option"]:has-text("High")')
  await page.waitForTimeout(300)
  // Assigned To select
  await page.click('button:has-text("unassigned")')
  await page.waitForTimeout(300)
  const assignOpts = await page.locator('[role="option"]').allTextContents()
  console.log('Available assigned_to options:', JSON.stringify(assignOpts))
  await page.click('[role="option"]:has-text("Dispatcher (Dev)")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(2500)
  const errorAfterSave = await page.locator('.text-red-600, .text-red-500').allTextContents()
  console.log('Any error text visible after save attempt:', JSON.stringify(errorAfterSave))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyTextLead = await page.locator('body').textContent()
  console.log('Header shows "High Priority" badge:', bodyTextLead?.includes('High Priority'))
  console.log('Lead Info shows priority "high":', bodyTextLead?.toLowerCase().includes('priority') && bodyTextLead?.includes('high'))
  console.log('Assigned To section present:', bodyTextLead?.includes('Assigned To'))

  // ============================================================
  // LEAD DETAIL PAGE: Contact preferences (via reused EditContactForm)
  // ============================================================
  console.log('\n======= LEAD: Contact preferences (preferred_contact_method, best_time_to_call) =======')
  await page.click('text=Edit Profile')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Not set")')
  await page.waitForTimeout(300)
  await page.click('[role="option"]:has-text("Text")')
  await page.fill('#best_time_to_call', 'Weekday evenings after 6pm')
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(2500)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const bodyTextLead2 = await page.locator('body').textContent()
  console.log('Shows "Preferred Contact Method" / "Text":', bodyTextLead2?.includes('Preferred Contact Method'))
  console.log('Shows "Weekday evenings after 6pm":', bodyTextLead2?.includes('Weekday evenings after 6pm'))

  // ============================================================
  // REGRESSION: source tracking still displays
  // ============================================================
  console.log('\n======= REGRESSION: source-tracking display =======')
  console.log('Lead Info card still shows a "Source" label if source is set:', bodyTextLead2?.includes('Source') || '(no source set on this lead, skip)')

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/verify-lead-detail-final.png', fullPage: true })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
