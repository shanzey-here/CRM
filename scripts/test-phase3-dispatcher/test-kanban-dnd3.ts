import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'

async function dispatchPointer(page: any, el: any, type: string, x: number, y: number, pointerId = 1) {
  await el.evaluate((node: Element, args: { type: string, x: number, y: number, pointerId: number }) => {
    const rect = node.getBoundingClientRect()
    const ev = new PointerEvent(args.type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: args.pointerId, pointerType: 'mouse', isPrimary: true,
      clientX: args.x, clientY: args.y, button: 0, buttons: args.type === 'pointerup' ? 0 : 1,
    })
    node.dispatchEvent(ev)
  }, { type, x, y, pointerId })
}

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
    page.waitForResponse((r: any) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const inquiryBadge = page.locator('span').filter({ hasText: /^15$/ }).first()
  const surveyBadge = page.locator('span').filter({ hasText: /^7$/ }).first()
  console.log('Inquiry BEFORE:', await inquiryBadge.textContent())
  console.log('Survey Scheduled BEFORE:', await surveyBadge.textContent())

  const cardSelector = '.group.relative.bg-white.rounded-xl.border'
  const sourceCard = page.locator(cardSelector).first()
  const sourceBox = await sourceCard.boundingBox()
  const columns = page.locator('[class*="w-72"]')
  const targetBox = await columns.nth(1).boundingBox()

  if (sourceBox && targetBox) {
    const startX = sourceBox.x + sourceBox.width / 2
    const startY = sourceBox.y + sourceBox.height / 2
    const endX = targetBox.x + targetBox.width / 2
    const endY = targetBox.y + 200

    await dispatchPointer(page, sourceCard, 'pointerdown', startX, startY)
    await page.waitForTimeout(100)

    const steps = 15
    for (let i = 1; i <= steps; i++) {
      const x = startX + ((endX - startX) * i) / steps
      const y = startY + ((endY - startY) * i) / steps
      await dispatchPointer(page, sourceCard, 'pointermove', x, y)
      await page.waitForTimeout(50)
    }

    await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03d-kanban-mid-drag-pointerevent.png', fullPage: true })

    await dispatchPointer(page, sourceCard, 'pointerup', endX, endY)
    await page.waitForTimeout(2500)
  }

  console.log('Inquiry AFTER:', await inquiryBadge.textContent())
  console.log('Survey Scheduled AFTER:', await surveyBadge.textContent())
  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03e-kanban-after-drag-pointerevent.png', fullPage: true })
  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
