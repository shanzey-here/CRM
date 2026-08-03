import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')

  await page.waitForTimeout(6000)
  console.log('page.url():', page.url())
  const heading = await page.locator('h1').first().textContent().catch(() => '(no h1 found)')
  console.log('First <h1> text:', heading)
  const bodyText = await page.textContent('body')
  console.log('Body sample (first 300 chars):', bodyText?.replace(/\s+/g, ' ').slice(0, 300))

  // Now do a genuine fresh top-level navigation to "/" as a real second visit
  // would, to check whether the session + redirect is fully functional.
  const resp = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  console.log('\n--- After explicit fresh GET / ---')
  console.log('page.url():', page.url())
  console.log('response status:', resp?.status())
  const heading2 = await page.locator('h1').first().textContent().catch(() => '(no h1 found)')
  console.log('First <h1> text:', heading2)

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
