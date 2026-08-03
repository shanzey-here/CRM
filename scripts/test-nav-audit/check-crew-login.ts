import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)

  page.on('response', (res) => {
    if (res.url().includes('/login') || res.url().includes('/crew')) {
      console.log('RESP', res.status(), res.url())
    }
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'crew@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(4000)

  const errorText = await page.locator('.text-destructive').first().textContent().catch(() => null)
  console.log('Visible error message (if any):', errorText)
  const h1 = await page.locator('h1').first().textContent().catch(() => '(none)')
  console.log('h1 after login+4s:', h1)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
