import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(90000)

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

  await Promise.all([
    page.waitForURL(/\/office\/leads\/[a-f0-9-]+$/, { timeout: 15000 }),
    card.click(),
  ])
  console.log('URL immediately after navigation event:', page.url())
  await page.waitForTimeout(1000)
  const heading = await page.locator('h1').first().textContent().catch(() => null)
  console.log('Page heading:', heading)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
