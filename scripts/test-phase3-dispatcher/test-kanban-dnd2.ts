import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
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
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const cardSelector = '.group.relative.bg-white.rounded-xl.border'
  const beforeText = await page.locator('h2:has-text("Survey Scheduled")').locator('..').locator('span').first().textContent().catch(() => null)
  console.log('Survey Scheduled count BEFORE:', await page.locator('text=Survey Scheduled').locator('..').locator('span').first().textContent())

  const sourceCard = page.locator(cardSelector).first()
  const sourceBox = await sourceCard.boundingBox()
  const columns = page.locator('[class*="w-72"]')
  const targetColumn = columns.nth(1) // Survey Scheduled
  const targetBox = await targetColumn.boundingBox()

  if (sourceBox && targetBox) {
    const startX = sourceBox.x + sourceBox.width / 2
    const startY = sourceBox.y + sourceBox.height / 2
    const endX = targetBox.x + targetBox.width / 2
    const endY = targetBox.y + 200

    await page.mouse.move(startX, startY)
    await page.waitForTimeout(150)
    await page.mouse.down()
    await page.waitForTimeout(150)

    // Many small incremental moves, each awaited with a real pause, to reliably
    // cross dnd-kit's PointerSensor activation distance and let React process
    // each intermediate pointermove.
    const steps = 20
    for (let i = 1; i <= steps; i++) {
      const x = startX + ((endX - startX) * i) / steps
      const y = startY + ((endY - startY) * i) / steps
      await page.mouse.move(x, y)
      await page.waitForTimeout(40)
    }

    await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03b-kanban-mid-drag.png', fullPage: true })

    await page.waitForTimeout(300)
    await page.mouse.up()
    await page.waitForTimeout(2500)
  }

  console.log('Survey Scheduled count AFTER:', await page.locator('text=Survey Scheduled').locator('..').locator('span').first().textContent())
  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03c-kanban-after-drag2.png', fullPage: true })
  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
