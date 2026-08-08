import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(90000)
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console error]', m.text()) })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  page.on('request', (r) => { if (r.method() === 'POST' || r.url().includes('/office/leads/')) console.log('[request]', r.method(), r.url()) })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const cardSelector = '.group.relative.bg-white.rounded-xl.border'
  const card = page.locator(cardSelector).first()
  const cardText = await card.textContent()
  console.log('Card to click, text:', cardText?.slice(0, 60))
  const box = await card.boundingBox()
  console.log('Card box:', JSON.stringify(box))

  await card.click()
  await page.waitForTimeout(3000)
  console.log('URL after .click():', page.url())

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
