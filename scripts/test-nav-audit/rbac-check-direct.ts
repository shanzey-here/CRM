import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function checkRole(email: string, password: string, label: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)

  // Wait for the login POST response directly (don't wait for full client nav/hydration)
  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  console.log(`${label}: login POST status:`, loginResp.status())
  await page.waitForTimeout(2000)

  // Now, with the session cookie set, hit /office directly and see the real HTTP response
  const officeResp = await page.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
  console.log(`${label}: GET /office -> final url=${page.url()} status=${officeResp?.status()}`)

  await page.close()
  await browser.close()
}

async function main() {
  await checkRole('crew@devtest.local', 'DevTest123!', 'crew')
  await checkRole('customer@devtest.local', 'DevTest123!', 'customer')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
