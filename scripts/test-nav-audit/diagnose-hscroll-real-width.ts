import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  // Real machine's WorkingArea when maximized: 1536x824 (1920x1080 physical @ 125% scaling)
  const page = await browser.newPage({ viewport: { width: 1536, height: 824 } })
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

  const info = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const cs = getComputedStyle(board)
    const columns = Array.from(board.children) as HTMLElement[]
    return {
      viewportWidth: window.innerWidth,
      boardClassName: board.className,
      overflowX: cs.overflowX,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      scrollWidth: board.scrollWidth,
      clientWidth: board.clientWidth,
      maxScroll: board.scrollWidth - board.clientWidth,
      columnCount: columns.length,
      columnWidths: columns.map((c) => c.getBoundingClientRect().width),
      lastColumnRect: columns[columns.length - 1]?.getBoundingClientRect(),
    }
  })
  console.log('=== Real-width (1536px) board measurements ===')
  console.log(JSON.stringify(info, null, 2))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/realwidth-before-scroll.png', fullPage: false })

  // Real wheel scroll
  const boardBox = await page.locator('.overflow-x-auto').boundingBox()
  await page.mouse.move(boardBox!.x + boardBox!.width / 2, boardBox!.y + boardBox!.height / 2)
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(400, 0)
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(300)

  const afterWheel = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    return { scrollLeft: board.scrollLeft, maxScroll: board.scrollWidth - board.clientWidth }
  })
  console.log('\n=== After real wheel-scroll at 1536px viewport ===')
  console.log(JSON.stringify(afterWheel, null, 2))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/realwidth-after-scroll.png', fullPage: false })

  // Check if the last column is now genuinely fully visible (not just scrollLeft matching max)
  const lastColVisible = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const columns = Array.from(board.children) as HTMLElement[]
    const last = columns[columns.length - 1]
    const lastRect = last.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    return {
      lastColLeft: lastRect.left,
      lastColRight: lastRect.right,
      boardLeft: boardRect.left,
      boardRight: boardRect.right,
      fullyVisible: lastRect.left >= boardRect.left - 1 && lastRect.right <= boardRect.right + 1,
    }
  })
  console.log('\n=== Last column full-visibility check ===')
  console.log(JSON.stringify(lastColVisible, null, 2))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
