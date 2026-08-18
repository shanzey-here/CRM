import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'dispatcher@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')

  await page.waitForTimeout(6000)
  const heading = await page.locator('h1').first().textContent().catch(() => '(no h1 found)')
  console.log('dispatcher: <h1> after login+6s:', heading)

  const resp = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  console.log('dispatcher: fresh GET / -> url:', page.url(), 'status:', resp?.status())
  const heading2 = await page.locator('h1').first().textContent().catch(() => '(no h1 found)')
  console.log('dispatcher: <h1> after fresh GET /:', heading2)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
