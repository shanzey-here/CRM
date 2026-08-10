import { chromium, Browser } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const PASSWORD = 'DevTest123!'
const SCREENSHOTS_DIR = process.env.VERIFY_SCREENSHOTS_DIR || path.join(require('os').tmpdir(), 'crm-verify-email-labels')
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function log(msg: string) {
  console.log(`\n=== ${msg} ===`)
}

async function login(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(90000)
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 90000 })
  await page.waitForTimeout(1500)
  return { context, page }
}

async function main() {
  const browser = await chromium.launch()
  try {
    // ── 1. Inbox: multiple emails with visibly distinct label chip colors ──
    log('1. Inbox with distinct label chip colors')
    const admin1 = await login(browser, 'admin@devtest.local')
    await admin1.page.goto(`${BASE}/office/email`)
    await admin1.page.waitForTimeout(2000)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-inbox-with-chips.png'), fullPage: true })
    const chipCount = await admin1.page.locator('a[href^="/office/email/"] span').count()
    console.log(`Chip-ish spans found on inbox rows: ${chipCount}`)

    // ── 5. Label filter ──
    log('5. Label filter (OR semantics)')
    await admin1.page.click('text=Paid')
    await admin1.page.waitForTimeout(1500)
    console.log('URL after clicking Paid filter pill:', admin1.page.url())
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-inbox-filtered-by-label.png'), fullPage: true })
    const rowsAfterFilter = await admin1.page.locator('a[href^="/office/email/"]').count()
    console.log(`Thread rows visible after filtering by "Paid": ${rowsAfterFilter}`)

    // ── Thread view: labels + Add label control ──
    log('Thread view: labels at top + Add label control')
    await admin1.page.goto(`${BASE}/office/email`)
    await admin1.page.waitForTimeout(1500)
    await admin1.page.click('text=Quote test - full detail 2')
    await admin1.page.waitForTimeout(2000)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-thread-view-labels.png'), fullPage: true })

    await admin1.page.click('text=Add label')
    await admin1.page.waitForTimeout(800)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-thread-add-label-dropdown.png'), fullPage: true })
    await admin1.page.click('text=Booking Confirmed')
    await admin1.page.waitForTimeout(1500)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-thread-after-add-label.png'), fullPage: true })
    const labelAppliedNow = await admin1.page.locator('text=Booking Confirmed').count()
    console.log(`"Booking Confirmed" chip now present on thread: ${labelAppliedNow > 0}`)

    // ── Manage Labels settings page ──
    log('Manage Labels settings page')
    await admin1.page.goto(`${BASE}/office/settings/email-labels`)
    await admin1.page.waitForTimeout(2000)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-manage-labels-list.png'), fullPage: true })

    // Create a custom label with a real picked color.
    await admin1.page.click('text=New Label')
    await admin1.page.waitForTimeout(500)
    await admin1.page.fill('input[type="text"]', 'VIP Customer')
    await admin1.page.fill('input[type="color"]', '#7C3AED')
    await admin1.page.click('button:has-text("Create Label")')
    await admin1.page.waitForTimeout(2000)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-manage-labels-after-custom-create.png'), fullPage: true })
    const customLabelVisible = await admin1.page.locator('text=VIP Customer').count()
    console.log(`Custom label "VIP Customer" visible in Manage Labels: ${customLabelVisible > 0}`)

    // ── Review queue: approve the pending suggestion ──
    log('Review queue: approve pending label suggestion (approved-suggestion domain_events path)')
    await admin1.page.goto(`${BASE}/office/email/review-queue`)
    await admin1.page.waitForTimeout(2000)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-review-queue-with-suggestion.png'), fullPage: true })
    const suggestionVisible = await admin1.page.locator('text=Suggested: Awaiting Reply').count()
    console.log(`Pending "Awaiting Reply" suggestion visible in review queue: ${suggestionVisible > 0}`)

    await admin1.page.click('text=Apply label')
    await admin1.page.waitForTimeout(2000)
    await admin1.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-review-queue-after-approve.png'), fullPage: true })
    const stillPending = await admin1.page.locator('text=Suggested: Awaiting Reply').count()
    console.log(`Suggestion still in queue after approve (expect false/0): ${stillPending}`)

    // ── Dispatcher: cannot access Manage Labels ──
    log('Dispatcher cannot manage labels (tenant_admin only)')
    const dispatcher = await login(browser, 'dispatcher@devtest.local')
    await dispatcher.page.goto(`${BASE}/office/settings/email-labels`)
    await dispatcher.page.waitForTimeout(1500)
    const dispatcherBlocked = await dispatcher.page.locator('text=Only tenant admins can manage email labels').count()
    console.log(`Dispatcher blocked from Manage Labels: ${dispatcherBlocked > 0}`)
    await dispatcher.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-dispatcher-blocked-manage-labels.png'), fullPage: true })

    // ── Cross-tenant: Tenant B only sees its own labels ──
    log('Cross-tenant isolation: Tenant B Manage Labels')
    const adminB = await login(browser, 'admin@second-dev-removals.local')
    await adminB.page.goto(`${BASE}/office/settings/email-labels`)
    await adminB.page.waitForTimeout(1500)
    await adminB.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-tenant-b-manage-labels.png'), fullPage: true })
    const tenantASeenByB = await adminB.page.locator('text=VIP Customer').count()
    console.log(`Tenant B sees Tenant A's custom "VIP Customer" label (expect false/0): ${tenantASeenByB}`)

    log('DONE — screenshots in ' + SCREENSHOTS_DIR)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
