import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
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

  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/02-kanban-before-drag.png', fullPage: true })

  const cardSelector = '.group.relative.bg-white.rounded-xl.border'

  // Test 1: click a card (must navigate, not accidentally drag)
  console.log('=== Test 1: click navigates to lead detail ===')
  const firstCard = page.locator(cardSelector).first()
  await firstCard.click()
  await page.waitForTimeout(2000)
  console.log('URL after click:', page.url())
  console.log('Navigated to lead detail:', page.url().includes('/office/leads/') && !page.url().endsWith('/leads'))

  await page.goto(`${BASE}/office/leads`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Test 2: real drag-and-drop between columns
  console.log('\n=== Test 2: real drag-and-drop between columns ===')
  const columns = page.locator('[class*="w-72"]')
  const columnCount = await columns.count()
  console.log('Column count:', columnCount)

  const sourceCard = page.locator(cardSelector).first()
  const sourceBox = await sourceCard.boundingBox()
  const targetColumn = columns.nth(1)
  const targetBox = await targetColumn.boundingBox()

  if (sourceBox && targetBox) {
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 5, { steps: 5 })
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 150, { steps: 10 })
    await page.waitForTimeout(300)
    await page.mouse.up()
    await page.waitForTimeout(2500)
  }

  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03-kanban-after-drag.png', fullPage: true })

  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
