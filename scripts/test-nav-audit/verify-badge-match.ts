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
  await page.waitForTimeout(3000)
  const result = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const header = firstColumn.children[0] as HTMLElement
    const badgeSpan = header.children[1] as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const cardCount = dropZone.querySelectorAll('[aria-label="Drag to reorder"]').length
    return { badgeText: badgeSpan.textContent, cardCount }
  })
  console.log('Badge vs actual rendered card count:', JSON.stringify(result))
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
