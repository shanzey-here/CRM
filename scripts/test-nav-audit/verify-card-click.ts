import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Click directly on the card's contact-name text (clearly not the grip handle)
  const firstCardName = page.locator('.overflow-x-auto p.font-semibold').first()
  const nameText = await firstCardName.textContent()
  console.log('Clicking card with name/id text:', nameText)
  await firstCardName.click()
  await page.waitForURL((url) => url.pathname !== '/office/leads', { timeout: 60000 }).catch((e) => console.log('waitForURL timed out:', e.message))
  console.log('URL after click:', page.url())
  const bodyText = await page.locator('body').textContent()
  console.log('Body sample:', bodyText?.replace(/\s+/g, ' ').slice(0, 300))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
