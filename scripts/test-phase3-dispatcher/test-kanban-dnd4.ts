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
    page.waitForResponse((r: any) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  console.log('Inquiry BEFORE:', await page.locator('span').filter({ hasText: /^15$/ }).first().textContent())
  console.log('Survey Scheduled BEFORE:', await page.locator('span').filter({ hasText: /^7$/ }).first().textContent())

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

    // pointerdown on the actual card (this is what dnd-kit's useSortable listens for directly)
    await sourceCard.evaluate((node: Element, args: any) => {
      node.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: args.x, clientY: args.y, button: 0, buttons: 1,
      }))
    }, { x: startX, y: startY })
    await page.waitForTimeout(100)

    // pointermove events dispatched on document/window, matching dnd-kit's real listener target
    const steps = 15
    for (let i = 1; i <= steps; i++) {
      const x = startX + ((endX - startX) * i) / steps
      const y = startY + ((endY - startY) * i) / steps
      await page.evaluate((args: any) => {
        window.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, cancelable: true, composed: true,
          pointerId: 1, pointerType: 'mouse', isPrimary: true,
          clientX: args.x, clientY: args.y, button: 0, buttons: 1,
        }))
        document.elementFromPoint(args.x, args.y)?.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, cancelable: true, composed: true,
          pointerId: 1, pointerType: 'mouse', isPrimary: true,
          clientX: args.x, clientY: args.y, button: 0, buttons: 1,
        }))
      }, { x, y })
      await page.waitForTimeout(50)
    }

    await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03f-mid-drag-doc.png', fullPage: true })

    await page.evaluate((args: any) => {
      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: args.x, clientY: args.y, button: 0, buttons: 0,
      }))
    }, { x: endX, y: endY })
    await page.waitForTimeout(2500)
  }

  console.log('Inquiry AFTER:', await page.locator('span').filter({ hasText: /^15$/ }).first().textContent().catch(() => 'CHANGED (no longer 15)'))
  console.log('Survey Scheduled AFTER:', await page.locator('span').filter({ hasText: /^8$/ }).first().textContent().catch(() => 'not 8'))
  await page.screenshot({ path: 'D:/CRM/scripts/test-phase3-dispatcher/03g-after-drag-doc.png', fullPage: true })
  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
