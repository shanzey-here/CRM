import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function loginAndCheck(email: string, password: string, label: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)

  // Fresh navigation to /office to see where this role actually lands / is allowed
  const resp = await page.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
  console.log(`${label}: GET /office -> url=${page.url()} status=${resp?.status()}`)
  if (page.url() === `${BASE}/office`) {
    const navLinks = await page.locator('nav a').allTextContents()
    console.log(`${label}: nav links =`, JSON.stringify(navLinks))
    console.log(`${label}: Workflows present (should be false for dispatcher):`, navLinks.includes('Workflows'))
  } else {
    const h1 = await page.locator('h1').first().textContent().catch(() => '(none)')
    console.log(`${label}: redirected away from /office, landed heading:`, h1)
  }

  await browser.close()
}

async function main() {
  await loginAndCheck('dispatcher@devtest.local', 'DevTest123!', 'dispatcher')
  await loginAndCheck('crew@devtest.local', 'DevTest123!', 'crew')
  await loginAndCheck('customer@devtest.local', 'DevTest123!', 'customer')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
