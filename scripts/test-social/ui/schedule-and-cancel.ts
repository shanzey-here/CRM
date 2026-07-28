import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

function localDatetimeValue(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)

  await page.goto(`${BASE}/login`)
  await page.waitForSelector('#email')
  await page.fill('#email', 'admin@devtest.local')
  await page.fill('#password', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

  await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Post to')

  const content = `Schedule-then-cancel UI test. ${new Date().toISOString()}`
  await page.fill('textarea[name="content"]', content)
  await page.locator('input[type="checkbox"][value]').first().click({ force: true })
  await page.locator('input[type="radio"][value="later"]').click({ force: true })

  const dt = localDatetimeValue(10 * 60 * 1000) // 10 minutes out
  await page.fill('input[type="datetime-local"]', dt)
  console.log('Scheduling for (local input value):', dt)

  await page.click('button[type="submit"]:has-text("Schedule post")')
  await page.waitForSelector('text=Scheduled for', { timeout: 30000 })
  console.log('Scheduled confirmation shown')

  // Reload to see it in the history list with a Cancel button (composer
  // doesn't optimistically inject into the list — same convention as the
  // rest of this app, relies on revalidatePath + next navigation).
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Cancel')
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/04-scheduled-pending.png', fullPage: true })

  await page.click('button:has-text("Cancel")')
  await page.waitForSelector('text=Cancelled', { timeout: 15000 })
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/05-cancelled.png', fullPage: true })
  console.log('Cancel button clicked, "Cancelled" text now shown')

  await browser.close()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
