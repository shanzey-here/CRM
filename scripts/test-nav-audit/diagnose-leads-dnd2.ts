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
  await page.waitForTimeout(2000)

  // Instrument raw pointer events at the document level to prove synthetic
  // events are actually reaching the browser's event system.
  await page.evaluate(() => {
    (window as any).__pointerLog = []
    document.addEventListener('pointerdown', (e) => (window as any).__pointerLog.push(`pointerdown x=${e.clientX} y=${e.clientY} pointerType=${e.pointerType}`), true)
    document.addEventListener('pointermove', (e) => (window as any).__pointerLog.push(`pointermove x=${e.clientX} y=${e.clientY}`), true)
    document.addEventListener('pointerup', (e) => (window as any).__pointerLog.push(`pointerup x=${e.clientX} y=${e.clientY}`), true)
  })

  const gripHandle = page.locator('[aria-label="Drag to reorder"]').first()
  const gripBox = await gripHandle.boundingBox()
  if (!gripBox) { console.log('No grip handle found'); await browser.close(); return }

  const startX = gripBox.x + gripBox.width / 2
  const startY = gripBox.y + gripBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 15, startY + 5)
  await page.mouse.move(startX + 60, startY + 10)
  await page.mouse.move(startX + 200, startY + 20)
  await page.waitForTimeout(200)

  const midDragState = await page.evaluate(() => {
    const card = document.querySelector('[aria-label="Drag to reorder"]')?.closest('div.group')
    const cs = card ? getComputedStyle(card) : null
    return {
      pointerLog: (window as any).__pointerLog,
      cardOpacity: cs?.opacity,
      cardTransform: cs?.transform,
    }
  })
  console.log('=== Mid-drag pointer event log + card style ===')
  console.log(JSON.stringify(midDragState, null, 2))

  await page.mouse.up()
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
