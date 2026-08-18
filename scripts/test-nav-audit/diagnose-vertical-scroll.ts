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

  const badgeCount = await page.locator('.overflow-x-auto > div').first().locator('span').last().textContent()
  console.log('Inquiry column badge count:', badgeCount)

  const info = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const header = firstColumn.children[0] as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const cardCountRendered = dropZone.querySelectorAll('[aria-label="Drag to reorder"]').length

    const els: [string, HTMLElement][] = [
      ['outerColumn', firstColumn],
      ['header', header],
      ['dropZone', dropZone],
    ]
    const result: any = { cardCountRendered }
    for (const [key, el] of els) {
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      result[key] = {
        className: el.className,
        overflowY: cs.overflowY,
        overflowX: cs.overflowX,
        height: cs.height,
        maxHeight: cs.maxHeight,
        rectHeight: rect.height,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
      }
    }
    return result
  })

  console.log('\n=== Column structure inspection ===')
  console.log(JSON.stringify(info, null, 2))

  // Try to actually scroll the drop zone down and see what happens
  const scrollResult = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const before = dropZone.scrollTop
    dropZone.scrollTop = 999999
    const after = dropZone.scrollTop
    return { before, after, maxPossibleScroll: dropZone.scrollHeight - dropZone.clientHeight }
  })
  console.log('\n=== Attempt to programmatically scroll drop zone ===')
  console.log(JSON.stringify(scrollResult, null, 2))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/vscroll-before.png' })

  // Real wheel scroll attempt directly over the Inquiry column
  const firstColBox = await page.locator('.overflow-x-auto > div').first().boundingBox()
  if (firstColBox) {
    await page.mouse.move(firstColBox.x + firstColBox.width / 2, firstColBox.y + firstColBox.height / 2)
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 300)
      await page.waitForTimeout(50)
    }
  }
  const afterWheel = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    return { scrollTop: dropZone.scrollTop, windowScrollY: window.scrollY, bodyScrollTop: document.body.scrollTop }
  })
  console.log('\n=== After real mouse-wheel scroll attempt over the column ===')
  console.log(JSON.stringify(afterWheel, null, 2))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/vscroll-after-wheel.png' })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
