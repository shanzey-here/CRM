import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()))
  page.on('pageerror', (err) => console.log('BROWSER PAGE EXCEPTION:', err.message))
  page.on('response', (res) => {
    if (res.url().endsWith('/') || res.url().includes('/office')) {
      console.log('NETWORK:', res.status(), res.url())
    }
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')

  console.log('URL immediately after click:', page.url())
  await page.waitForTimeout(1000)
  console.log('URL after 1s:', page.url())
  await page.waitForTimeout(2000)
  console.log('URL after 3s:', page.url())
  await page.waitForTimeout(3000)
  console.log('URL after 6s:', page.url())
  await page.waitForTimeout(5000)
  console.log('URL after 11s:', page.url())
  await page.waitForTimeout(8000)
  console.log('URL after 19s:', page.url())

  const bodyText = await page.textContent('body')
  console.log('\nFull visible body text at 11s mark:')
  console.log(bodyText?.slice(0, 500))

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
