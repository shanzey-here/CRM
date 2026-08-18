import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const debugLogs: string[] = []
  const allErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.text().includes('DEBUG handleDragEnd')) debugLogs.push(msg.text())
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text()}`)
  })
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${err.message}\n${err.stack}`))

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

  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(0).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(1).locator('div.flex.flex-col.gap-2').first()
  const card = srcDropZone.locator('> div').first()
  const grip = card.locator('[aria-label="Drag to reorder"]')
  const gripBox = await grip.boundingBox()
  const dstBox = await dstDropZone.boundingBox()
  if (!gripBox || !dstBox) { console.log('missing boxes'); await browser.close(); return }

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
  await page.mouse.up()
  await page.waitForTimeout(1500)

  console.log('=== handleDragEnd debug logs ===')
  debugLogs.forEach((l) => console.log(l))
  if (debugLogs.length === 0) console.log('(none captured — handleDragEnd may not have fired at all)')

  console.log('\n=== All console errors / page exceptions ===')
  allErrors.forEach((e) => console.log(e))
  if (allErrors.length === 0) console.log('(none)')

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
