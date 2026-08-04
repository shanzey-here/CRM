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

  const before = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const cs = getComputedStyle(dropZone)
    return {
      overflowY: cs.overflowY,
      scrollHeight: dropZone.scrollHeight,
      clientHeight: dropZone.clientHeight,
      scrollTop: dropZone.scrollTop,
      totalCardsInDOM: dropZone.querySelectorAll('[aria-label="Drag to reorder"]').length,
    }
  })
  console.log('\n=== Drop zone computed style (against real committed source) ===')
  console.log(JSON.stringify(before, null, 2))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/vscroll-final-before.png' })

  // Real wheel-scroll (not programmatic) over the column, to the bottom
  const firstColBox = await page.locator('.overflow-x-auto > div').first().boundingBox()
  await page.mouse.move(firstColBox!.x + firstColBox!.width / 2, firstColBox!.y + firstColBox!.height / 2)
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(500)

  const after = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    return {
      scrollTop: dropZone.scrollTop,
      scrollHeight: dropZone.scrollHeight,
      clientHeight: dropZone.clientHeight,
      reachedMax: dropZone.scrollTop >= dropZone.scrollHeight - dropZone.clientHeight - 2, // small tolerance
    }
  })
  console.log('\n=== After real wheel-scroll to the bottom ===')
  console.log(JSON.stringify(after, null, 2))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/vscroll-final-after.png' })

  // Confirm the LAST card (18th, by DOM order) is now actually visible within the column bounds
  const lastCardVisible = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    const cards = dropZone.querySelectorAll('[aria-label="Drag to reorder"]')
    const lastCard = cards[cards.length - 1] as HTMLElement
    const cardRect = lastCard.getBoundingClientRect()
    const dzRect = dropZone.getBoundingClientRect()
    return {
      totalCards: cards.length,
      lastCardTop: cardRect.top,
      lastCardBottom: cardRect.bottom,
      dropZoneTop: dzRect.top,
      dropZoneBottom: dzRect.bottom,
      fullyVisible: cardRect.top >= dzRect.top - 1 && cardRect.bottom <= dzRect.bottom + 1,
    }
  })
  console.log('\n=== Last card (18th) visibility check ===')
  console.log(JSON.stringify(lastCardVisible, null, 2))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
