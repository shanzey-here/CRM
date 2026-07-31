import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'
const CONTACT_ID = process.argv[2]
const QUOTE_ID = process.argv[3]

async function loginAs(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 60000 })
  } catch {
    console.log('  (login did not redirect away from /login within 60s)')
  }
  await page.waitForTimeout(1000)
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // --- Contact detail page as tenant_admin: Negotiated Rate card visible ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/clients/${CONTACT_ID}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.screenshot({ path: 'scripts/test-corporate-pricing/screenshots/admin-contact.png', fullPage: true })
    console.log('=== CONTACT PAGE as tenant_admin ===')
    const bodyText = await page.locator('body').innerText()
    console.log(bodyText)
    console.log('\n"Negotiated Rate" section present:', bodyText.includes('Negotiated Rate'))
    console.log('"Set Rate" or "Edit Rate" button present:', bodyText.includes('Set Rate') || bodyText.includes('Edit Rate'))
    await page.close()
  }

  // --- Contact detail page as dispatcher: Negotiated Rate card must NOT render ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'dispatcher@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/clients/${CONTACT_ID}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.screenshot({ path: 'scripts/test-corporate-pricing/screenshots/dispatcher-contact.png', fullPage: true })
    console.log('\n=== CONTACT PAGE as dispatcher ===')
    const bodyText = await page.locator('body').innerText()
    console.log('"Negotiated Rate" section present (must be false):', bodyText.includes('Negotiated Rate'))
    await page.close()
  }

  // --- Quote workspace page as tenant_admin: Pricing card shows both figures ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/quotes/${QUOTE_ID}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.screenshot({ path: 'scripts/test-corporate-pricing/screenshots/quote-workspace.png', fullPage: true })
    console.log('\n=== QUOTE WORKSPACE PAGE (negotiated quote) ===')
    const bodyText = await page.locator('body').innerText()
    console.log(bodyText)
    console.log('\n"Standard Price" shown:', bodyText.includes('Standard Price'))
    console.log('"Negotiated Rate" badge shown:', bodyText.includes('Negotiated Rate'))
    console.log('"Final Price" shown:', bodyText.includes('Final Price'))
    await page.close()
  }

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
