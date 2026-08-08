import { chromium, devices } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'
const SHOT_DIR = 'D:/CRM/scripts/test-crew-ui'

async function dispatchPointer(el: any, type: string, x: number, y: number) {
  await el.evaluate((node: Element, args: { type: string, x: number, y: number }) => {
    const rect = node.getBoundingClientRect()
    const ev = new PointerEvent(args.type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 1, pointerType: 'touch', isPrimary: true,
      clientX: args.x, clientY: args.y, button: 0, buttons: args.type === 'pointerup' ? 0 : 1,
    })
    node.dispatchEvent(ev)
  }, { type, x, y })
}

async function main() {
  const iPhone = devices['iPhone 13']
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ ...iPhone })
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

  const startX = box.x + 20
  const startY = box.y + box.height / 2
  await dispatchPointer(canvas, 'pointerdown', startX, startY)
  await page.waitForTimeout(50)

  const points = [
    [box.x + 40, box.y + 20],
    [box.x + 70, box.y + box.height - 20],
    [box.x + 100, box.y + 20],
    [box.x + 130, box.y + box.height - 20],
  ]
  for (const [x, y] of points) {
    await dispatchPointer(canvas, 'pointermove', x, y)
    await page.waitForTimeout(50)
  }
  await dispatchPointer(canvas, 'pointerup', points[points.length - 1][0], points[points.length - 1][1])
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
  console.log('Canvas is empty after PointerEvent drawing (should be false):', isEmpty)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
