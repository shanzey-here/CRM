import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

function getCounts(page: any) {
  return page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().endsWith('/office/leads')) {
      const body = await res.text().catch(() => '(failed to read)')
      netLog.push(`status=${res.status()} bodyStart=${body.slice(0, 150)}`)
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
  await page.waitForTimeout(3000)

  console.log('Before:', JSON.stringify(await getCounts(page)))

  // Column 3 (Quote Sent, idx 2) -> Column 5 (Confirmed Booking, idx 4).
  // Scroll column 5 into view first since the board is horizontally scrollable
  // and the last column can be off-screen at this viewport width.
  await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const col = board.children[4] as HTMLElement
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
  await page.waitForTimeout(500)

  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(2).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(4).locator('div.flex.flex-col.gap-2').first()
  const card = srcDropZone.locator('> div').first()
  const grip = card.locator('[aria-label="Drag to reorder"]')
  const leadContactText = await card.evaluate((el: HTMLElement) => el.textContent?.slice(0, 36))
  console.log('Dragging card (contact_id shown):', leadContactText)

  const gripBox = await grip.boundingBox()
  const dstBox = await dstDropZone.boundingBox()
  console.log('gripBox:', JSON.stringify(gripBox))
  console.log('dstBox:', JSON.stringify(dstBox))
  if (!gripBox || !dstBox) { console.log('MISSING BOXES — aborting'); await browser.close(); return }

  const startX = gripBox.x + gripBox.width / 2, startY = gripBox.y + gripBox.height / 2
  const endX = dstBox.x + dstBox.width / 2, endY = dstBox.y + 60

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const steps = 25
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (endX - startX) * i / steps, startY + (endY - startY) * i / steps)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(300)

  const highlight = await columns.nth(4).evaluate((el: HTMLElement) => el.style.boxShadow)
  console.log('Destination isOver boxShadow at drop time:', JSON.stringify(highlight))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/final2-mid-drag.png' })

  await page.mouse.up()
  await page.waitForTimeout(8000)

  console.log('Network:', netLog.length ? JSON.stringify(netLog, null, 2) : '(none)')
  console.log('After (same session):', JSON.stringify(await getCounts(page)))
  const errorBanner = await page.locator('[role="alert"]').textContent().catch(() => null)
  console.log('Error banner:', errorBanner)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/final2-after-drop.png' })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  console.log('After RELOAD (persistence):', JSON.stringify(await getCounts(page)))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
