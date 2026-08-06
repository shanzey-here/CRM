import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1536, height: 824 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().endsWith('/office/leads')) {
      const body = await res.text().catch(() => '')
      if (!body.includes('notification_type')) netLog.push(`status=${res.status()}`)
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

  // ---- Part A: vertical within-column scroll, at real viewport width ----
  console.log('=== Part A: vertical column scroll at 1536px ===')
  const vBefore = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    return { overflowY: getComputedStyle(dropZone).overflowY, scrollHeight: dropZone.scrollHeight, clientHeight: dropZone.clientHeight }
  })
  console.log('Drop zone style:', JSON.stringify(vBefore))

  const firstColBox = await page.locator('.overflow-x-auto > div').first().boundingBox()
  await page.mouse.move(firstColBox!.x + firstColBox!.width / 2, firstColBox!.y + firstColBox!.height / 2)
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(300)
  const vAfter = await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    const dropZone = firstColumn.children[1] as HTMLElement
    return { scrollTop: dropZone.scrollTop, reachedMax: dropZone.scrollTop >= dropZone.scrollHeight - dropZone.clientHeight - 2 }
  })
  console.log('After real wheel-scroll down:', JSON.stringify(vAfter))

  // reset vertical scroll before drag test
  await page.evaluate(() => {
    const firstColumn = document.querySelector('.overflow-x-auto > div') as HTMLElement
    ;(firstColumn.children[1] as HTMLElement).scrollTop = 0
  })
  await page.waitForTimeout(300)

  // ---- Part B: drag-and-drop, at real viewport width ----
  console.log('\n=== Part B: drag-and-drop at 1536px ===')
  const getCounts = () => page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
  console.log('Before:', JSON.stringify(await getCounts()))

  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(0).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(1).locator('div.flex.flex-col.gap-2').first()
  const card = srcDropZone.locator('> div').first()
  const grip = card.locator('[aria-label="Drag to reorder"]')
  const gripBox = await grip.boundingBox()
  const dstBox = await dstDropZone.boundingBox()
  const startX = gripBox!.x + gripBox!.width / 2, startY = gripBox!.y + gripBox!.height / 2
  const endX = dstBox!.x + dstBox!.width / 2, endY = dstBox!.y + 60

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const steps = 20
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (endX - startX) * i / steps, startY + (endY - startY) * i / steps)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(300)
  const highlight = await columns.nth(1).evaluate((el: HTMLElement) => el.style.boxShadow)
  console.log('isOver highlight at drop time:', JSON.stringify(highlight))
  await page.mouse.up()
  await page.waitForTimeout(8000)
  console.log('Network (updateLeadStage):', netLog.length ? netLog : '(none)')
  console.log('After:', JSON.stringify(await getCounts()))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  console.log('After RELOAD (persistence):', JSON.stringify(await getCounts()))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
