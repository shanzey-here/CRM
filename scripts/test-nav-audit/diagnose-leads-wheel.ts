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

  const before = await page.evaluate(() => {
    const el = document.querySelector('.overflow-x-auto') as HTMLElement
    return { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  })
  console.log('Before wheel:', JSON.stringify(before))

  // Hover over the board and perform a real wheel scroll (shift+wheel = horizontal in most browsers,
  // but also try plain deltaX directly since that's what trackpads send)
  const box = await page.locator('.overflow-x-auto').boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  }

  // Simulate a large horizontal wheel scroll (deltaX), like a trackpad swipe
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(400, 0)
    await page.waitForTimeout(50)
  }

  const after = await page.evaluate(() => {
    const el = document.querySelector('.overflow-x-auto') as HTMLElement
    return { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  })
  console.log('After 20x wheel(400,0):', JSON.stringify(after))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-after-wheel.png', fullPage: false })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
