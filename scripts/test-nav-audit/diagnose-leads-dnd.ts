import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const consoleMsgs: string[] = []
  page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`))

  const netLog: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST') netLog.push(`>> POST ${req.url()} postData=${req.postData()?.slice(0, 300)}`)
  })
  page.on('response', async (res) => {
    if (res.request().method() === 'POST') {
      let body = ''
      try { body = (await res.text()).slice(0, 500) } catch {}
      netLog.push(`<< ${res.status()} ${res.url()} body=${body}`)
    }
  })

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

  // Find a card in the first column (Inquiry) to drag
  const firstColumn = page.locator('.overflow-x-auto > div').first()
  const card = firstColumn.locator('[class*="rounded"]').filter({ hasText: /-/ }).first()
  // Use a more robust selector: cards contain a truncated UUID text. Let's grab by the drag handle icon (⠿-like) or just the whole card element.
  const cardEl = firstColumn.locator('div.flex.flex-col').first()

  console.log('=== Before drag: leads by column count ===')
  const beforeCounts = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({
      label: c.querySelector('span')?.textContent,
      count: c.querySelectorAll('[class*="rounded-lg"]').length,
    }))
  })
  console.log(JSON.stringify(beforeCounts, null, 2))

  // Get the first card's bounding box in column 1, and column 2's drop area bounding box
  const columns = page.locator('.overflow-x-auto > div')
  const col1 = columns.nth(0)
  const col2 = columns.nth(1)

  const firstCard = col1.locator('div[style*="translate"], div.flex.flex-col.gap-2 > div').first()
  // Simpler: any direct child div inside the drop zone that isn't the "Drop here" placeholder
  const dropZone1 = col1.locator('div.flex.flex-col.gap-2').first()
  const cardsInCol1 = dropZone1.locator('> div')
  const firstCardCount = await cardsInCol1.count()
  console.log('Cards found in column 1 drop zone:', firstCardCount)

  if (firstCardCount === 0) {
    console.log('No cards in first column to drag — aborting DnD test')
    await browser.close()
    return
  }

  const cardBox = await cardsInCol1.first().boundingBox()
  // The drag handle is the GripVertical icon, aria-label="Drag to reorder" —
  // that's where dnd-kit's pointer listeners actually live, not the card body.
  const gripHandle = cardsInCol1.first().locator('[aria-label="Drag to reorder"]')
  const gripBox = await gripHandle.boundingBox()
  const col2DropZone = col2.locator('div.flex.flex-col.gap-2').first()
  const col2Box = await col2DropZone.boundingBox()

  console.log('Card box:', JSON.stringify(cardBox))
  console.log('Grip handle box:', JSON.stringify(gripBox))
  console.log('Column 2 drop zone box:', JSON.stringify(col2Box))

  if (!cardBox || !gripBox || !col2Box) {
    console.log('Could not compute bounding boxes — aborting')
    await browser.close()
    return
  }

  const startX = gripBox.x + gripBox.width / 2
  const startY = gripBox.y + gripBox.height / 2
  const endX = col2Box.x + col2Box.width / 2
  const endY = col2Box.y + 40

  netLog.length = 0 // clear pre-drag network noise
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Move in small steps to exceed the 8px activation distance and trigger real dnd-kit events
  await page.mouse.move(startX + 20, startY, { steps: 5 })
  await page.waitForTimeout(150)

  // Mid-drag check: is dnd-kit's DragOverlay ghost card actually rendering?
  // (activeId state set by handleDragStart -> confirms the drag genuinely activated)
  const overlayVisible = await page.evaluate(() => {
    // DragOverlay renders in a portal; look for any element with dnd-kit's typical transform styling duplicated
    return document.body.innerHTML.includes('isDragOverlay') || document.querySelectorAll('[style*="cursor: grabbing"], [class*="DragOverlay"]').length
  })
  console.log('Mid-drag: page has cursor:grabbing or overlay markers:', overlayVisible)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-mid-drag.png', fullPage: false })

  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 15 })
  await page.waitForTimeout(150)
  await page.mouse.move(endX, endY, { steps: 15 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-mid-drag2.png', fullPage: false })
  await page.mouse.up()
  await page.waitForTimeout(2000)

  console.log('\n=== Network activity during drag/drop ===')
  netLog.forEach((l) => console.log(l))
  if (netLog.length === 0) console.log('(no POST requests captured during drag)')

  console.log('\n=== Console messages ===')
  consoleMsgs.slice(-20).forEach((m) => console.log(m))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-after-drag.png', fullPage: false })

  const afterCounts = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({
      label: c.querySelector('span')?.textContent,
      count: c.querySelectorAll('[class*="rounded-lg"]').length,
    }))
  })
  console.log('\n=== After drag: leads by column count ===')
  console.log(JSON.stringify(afterCounts, null, 2))

  // Check for the error banner
  const errorBanner = await page.locator('[role="alert"]').textContent().catch(() => null)
  console.log('\nError banner text (if any):', errorBanner)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
