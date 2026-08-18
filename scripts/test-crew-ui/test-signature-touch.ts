import { chromium, devices } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'

async function main() {
  const iPhone = devices['iPhone 13']
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ ...iPhone, hasTouch: true })
  const page = await context.newPage()
  page.setDefaultTimeout(120000)
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'crew@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  await page.goto(`${BASE}/crew/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(20000)

  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')

  // Use Playwright's real touchscreen simulation (genuine touchstart/touchmove/touchend)
  await page.touchscreen.tap(box.x + 20, box.y + box.height / 2)
  await page.waitForTimeout(100)

  // touchscreen.tap only does a single tap; for a drag we need to dispatch touch events manually via CDP-level input
  // Try dragging using mouse with touch-like down/move/up but through the canvas element handle directly
  const canvasHandle = await canvas.elementHandle()
  await page.evaluate((el) => {
    const fireTouch = (type: string, x: number, y: number) => {
      const touch = new Touch({ identifier: 1, target: el as Element, clientX: x, clientY: y })
      const ev = new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [touch], targetTouches: type === 'touchend' ? [] : [touch], changedTouches: [touch] })
      el!.dispatchEvent(ev)
    }
    const rect = (el as Element).getBoundingClientRect()
    fireTouch('touchstart', rect.x + 20, rect.y + rect.height / 2)
    fireTouch('touchmove', rect.x + 50, rect.y + 20)
    fireTouch('touchmove', rect.x + 90, rect.y + rect.height - 20)
    fireTouch('touchmove', rect.x + 130, rect.y + 20)
    fireTouch('touchend', rect.x + 130, rect.y + 20)
  }, canvasHandle)
  await page.waitForTimeout(500)

  const isEmpty = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (!ctx) return true
    const data = ctx.getImageData(0, 0, el.width, el.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false
    }
    return true
  })
  console.log('Canvas is empty after TouchEvent drawing (should be false):', isEmpty)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
