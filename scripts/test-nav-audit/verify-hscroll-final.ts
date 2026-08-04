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

  // Programmatic check
  const programmatic = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const before = board.scrollLeft
    board.scrollLeft = 999999
    const after = board.scrollLeft
    return { before, after, scrollWidth: board.scrollWidth, clientWidth: board.clientWidth, maxScroll: board.scrollWidth - board.clientWidth }
  })
  console.log('Programmatic horizontal scroll (real committed source):', JSON.stringify(programmatic))

  // Reset and do a real wheel scroll
  await page.evaluate(() => { (document.querySelector('.overflow-x-auto') as HTMLElement).scrollLeft = 0 })
  const boardBox = await page.locator('.overflow-x-auto').boundingBox()
  await page.mouse.move(boardBox!.x + boardBox!.width / 2, boardBox!.y + boardBox!.height / 2)
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(400, 0)
    await page.waitForTimeout(50)
  }
  const afterWheel = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    return { scrollLeft: board.scrollLeft, maxScroll: board.scrollWidth - board.clientWidth }
  })
  console.log('Real wheel horizontal scroll (real committed source):', JSON.stringify(afterWheel))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/hscroll-final.png' })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
