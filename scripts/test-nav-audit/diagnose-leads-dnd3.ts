import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/office/leads')) {
      netLog.push(`>> POST ${req.url()} postData=${req.postData()?.slice(0, 200)}`)
    }
  })
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes('/office/leads')) {
      let body = ''
      try { body = (await res.text()).slice(0, 800) } catch {}
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

  const beforeCounts = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
  console.log('=== Before ===', JSON.stringify(beforeCounts))

  const columns = page.locator('.overflow-x-auto > div')
  const col1DropZone = columns.nth(0).locator('div.flex.flex-col.gap-2').first()
  const col2DropZone = columns.nth(1).locator('div.flex.flex-col.gap-2').first()

  const firstCard = col1DropZone.locator('> div').first()
  const gripHandle = firstCard.locator('[aria-label="Drag to reorder"]')
  const gripBox = await gripHandle.boundingBox()
  const col2Box = await col2DropZone.boundingBox()
  if (!gripBox || !col2Box) { console.log('missing boxes'); await browser.close(); return }

  const draggedCardId = await firstCard.evaluate((el) => el.textContent?.slice(0, 40))
  console.log('Dragging card starting with:', draggedCardId)

  const startX = gripBox.x + gripBox.width / 2
  const startY = gripBox.y + gripBox.height / 2
  const endX = col2Box.x + col2Box.width / 2
  const endY = col2Box.y + 60

  await page.mouse.move(startX, startY)
  await page.mouse.down()

  // Many small, discrete moves toward the destination — gives React/dnd-kit
  // time to process each pointermove and re-run collision detection.
  const steps = 25
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    const y = startY + ((endY - startY) * i) / steps
    await page.mouse.move(x, y)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(300)

  // Check column 2's isOver highlight (box-shadow) right before dropping
  const col2Highlight = await columns.nth(1).evaluate((el) => (el as HTMLElement).style.boxShadow)
  console.log('Column 2 boxShadow just before drop (non-empty = isOver true):', JSON.stringify(col2Highlight))
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-dnd3-before-drop.png' })

  await page.mouse.up()
  await page.waitForTimeout(2500)

  console.log('\n=== Network (updateLeadStage server action) ===')
  netLog.forEach((l) => console.log(l))
  if (netLog.length === 0) console.log('(none captured)')

  const afterCounts = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
  console.log('\n=== After ===', JSON.stringify(afterCounts))

  const errorBanner = await page.locator('[role="alert"]').textContent().catch(() => null)
  console.log('Error banner:', errorBanner)

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-dnd3-after-drop.png' })

  // Reload and check persistence
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const afterReloadCounts = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
  console.log('\n=== After reload (persistence check) ===', JSON.stringify(afterReloadCounts))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
