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

  // Runtime-only CSS injection previewing the proposed fix — no source file touched.
  await page.addStyleTag({ content: `
    .overflow-x-auto > div > div:nth-child(2) { overflow-y: auto !important; max-height: 100%; }
  ` })
  await page.waitForTimeout(500)

  const scrollTest = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const before = dropZone.scrollTop
    dropZone.scrollTop = 999999
    const after = dropZone.scrollTop
    return { before, after, scrollHeight: dropZone.scrollHeight, clientHeight: dropZone.clientHeight }
  })
  console.log('=== Programmatic scroll test WITH overflow-y-auto applied ===')
  console.log(JSON.stringify(scrollTest, null, 2))

  // Reset scroll, then confirm real wheel-scroll works and reveals more cards
  await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    ;(firstColumn.children[1] as HTMLElement).scrollTop = 0
  })
  const cardsVisibleBefore = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const cards = Array.from(dropZone.querySelectorAll('[aria-label="Drag to reorder"]'))
    return cards.filter((c) => {
      const r = (c as HTMLElement).getBoundingClientRect()
      const dz = dropZone.getBoundingClientRect()
      return r.top >= dz.top && r.bottom <= dz.bottom
    }).length
  })
  console.log('Cards actually visible within the column viewport BEFORE scroll:', cardsVisibleBefore)

  const firstColBox = await page.locator('.overflow-x-auto > div').first().boundingBox()
  await page.mouse.move(firstColBox!.x + firstColBox!.width / 2, firstColBox!.y + firstColBox!.height / 2)
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(50)
  }
  const afterWheel = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    return { scrollTop: dropZone.scrollTop, windowScrollY: window.scrollY }
  })
  console.log('After real wheel-scroll over the column WITH fix applied:', JSON.stringify(afterWheel))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/prevalidate-scrolled.png' })

  // Reset the column scroll back to top before testing drag — the wheel-scroll
  // check above intentionally scrolled it to the bottom.
  await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    ;(firstColumn.children[1] as HTMLElement).scrollTop = 0
  })
  await page.waitForTimeout(300)

  // Now: does drag-and-drop still work with the scrollable column? Real drag test.
  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().endsWith('/office/leads')) {
      const body = await res.text().catch(() => '')
      if (!body.includes('notification_type')) netLog.push(`status=${res.status()} body=${body.slice(0, 150)}`)
    }
  })

  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(0).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(1).locator('div.flex.flex-col.gap-2').first()
  const card = srcDropZone.locator('> div').first()
  const grip = card.locator('[aria-label="Drag to reorder"]')
  const gripBox = await grip.boundingBox()
  const dstBox = await dstDropZone.boundingBox()
  if (!gripBox || !dstBox) { console.log('MISSING BOXES for drag test'); await browser.close(); return }

  const startX = gripBox.x + gripBox.width / 2, startY = gripBox.y + gripBox.height / 2
  const endX = dstBox.x + dstBox.width / 2, endY = dstBox.y + 60

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const steps = 20
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (endX - startX) * i / steps, startY + (endY - startY) * i / steps)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(300)
  const highlight = await columns.nth(1).evaluate((el: HTMLElement) => el.style.boxShadow)
  console.log('\nDrag test WITH scrollable column applied — isOver highlight:', JSON.stringify(highlight))
  await page.mouse.up()
  await page.waitForTimeout(8000)
  console.log('Network during drag:', netLog.length ? netLog : '(none)')

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
