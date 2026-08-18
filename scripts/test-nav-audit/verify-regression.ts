import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const LEAD_ID = 'd292cd7a-576c-417c-8dee-9350bff59e67'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
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

  console.log('======= Regression: source display on Lead detail =======')
  await page.goto(`${BASE}/office/leads/${LEAD_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const leadBodyText = await page.locator('body').textContent()
  console.log('Shows Source label:', leadBodyText?.includes('Source'))
  console.log('Shows "referral" value:', leadBodyText?.includes('referral'))

  console.log('\n======= Regression: source display on Kanban board =======')
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const kanbanLoaded = await page.locator('.overflow-x-auto > div').count()
  console.log('Kanban columns rendered:', kanbanLoaded)

  console.log('\n======= Regression: drag-and-drop still works =======')
  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(0).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(1).locator('div.flex.flex-col.gap-2').first()
  const cardCount = await srcDropZone.locator('> div').count()
  console.log('Cards in first column:', cardCount)

  if (cardCount > 0) {
    const card = srcDropZone.locator('> div').first()
    const grip = card.locator('[aria-label="Drag to reorder"]')
    const gripBox = await grip.boundingBox()
    const dstBox = await dstDropZone.boundingBox()
    if (gripBox && dstBox) {
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
      console.log('isOver highlight fired:', !!highlight)
      netLog.length = 0
      await page.mouse.up()
      await page.waitForTimeout(8000)
      console.log('Network during drag:', netLog.length ? netLog : '(none)')
    }
  }

  console.log('\n======= Regression: horizontal scroll still works =======')
  const scrollResult = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const before = board.scrollLeft
    board.scrollLeft = 999999
    const after = board.scrollLeft
    return { before, after, maxScroll: board.scrollWidth - board.clientWidth }
  })
  console.log('Horizontal scroll result:', JSON.stringify(scrollResult))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
