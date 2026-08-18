import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
  page.setDefaultTimeout(90000)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/scheduling?date=2026-08-15`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/04-scheduling-before.png', fullPage: true })

  const poolText = await page.locator('text=/require assignment/').textContent()
  console.log('Jobs pool status BEFORE:', poolText)

  // Find the first draggable job card in the pool
  const jobCard = page.locator('div.bg-white.p-3.rounded-md.border.shadow-sm').first()
  const cardBox = await jobCard.boundingBox()

  // Find a droppable timeline cell to drop onto (first vehicle row, first hour cell)
  const targetCell = page.locator('.flex-1.border-r.transition-colors').first()
  const targetBox = await targetCell.boundingBox()

  console.log('Card box:', JSON.stringify(cardBox))
  console.log('Target cell box:', JSON.stringify(targetBox))

  if (cardBox && targetBox) {
    const startX = cardBox.x + cardBox.width / 2
    const startY = cardBox.y + cardBox.height / 2
    const endX = targetBox.x + targetBox.width / 2
    const endY = targetBox.y + targetBox.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.waitForTimeout(100)
    const steps = 15
    for (let i = 1; i <= steps; i++) {
      const x = startX + ((endX - startX) * i) / steps
      const y = startY + ((endY - startY) * i) / steps
      await page.mouse.move(x, y)
      await page.waitForTimeout(40)
    }
    await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/05-scheduling-mid-drag.png', fullPage: true })
    await page.waitForTimeout(200)
    await page.mouse.up()
    await page.waitForTimeout(2500)
  }

  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/06-scheduling-after.png', fullPage: true })
  const poolTextAfter = await page.locator('text=/require assignment/').textContent()
  console.log('Jobs pool status AFTER:', poolTextAfter)
  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
