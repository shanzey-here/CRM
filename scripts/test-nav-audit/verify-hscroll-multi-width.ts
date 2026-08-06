import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function testWidth(width: number, height: number, label: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width, height } })
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

  const before = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    return { scrollWidth: board.scrollWidth, clientWidth: board.clientWidth, maxScroll: board.scrollWidth - board.clientWidth }
  })

  const boardBox = await page.locator('.overflow-x-auto').boundingBox()
  await page.mouse.move(boardBox!.x + boardBox!.width / 2, boardBox!.y + boardBox!.height / 2)
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(400, 0)
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(300)

  const after = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const columns = Array.from(board.children) as HTMLElement[]
    const last = columns[columns.length - 1]
    const lastRect = last.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    return {
      scrollLeft: board.scrollLeft,
      lastColRight: lastRect.right,
      boardRight: boardRect.right,
      breathingRoom: boardRect.right - lastRect.right,
    }
  })

  console.log(`\n=== ${label} (${width}x${height}) ===`)
  console.log('Before scroll:', JSON.stringify(before))
  console.log('After real wheel-scroll:', JSON.stringify(after))

  await page.screenshot({ path: `D:/CRM/scripts/test-nav-audit/multiwidth-${width}.png` })

  await browser.close()
}

async function main() {
  await testWidth(1536, 824, 'Real machine maximized (1920x1080 @ 125% DPI)')
  await testWidth(1920, 1040, 'Common 1080p desktop, no DPI scaling')
  await testWidth(1366, 728, 'Common smaller laptop display')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
