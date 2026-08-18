import { chromium, devices } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'
const SHOT_DIR = 'D:/CRM/scripts/test-crew-ui'

async function main() {
  const iPhone = devices['iPhone 13']
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ ...iPhone })
  const page = await context.newPage()
  page.setDefaultTimeout(120000)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('hydrated')) consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

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

  // Type the customer name
  await page.fill('input[placeholder="John Doe"]', 'Real Signature Test Customer')

  // Draw an actual signature on the canvas via real mouse drag events
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  console.log('Canvas bounding box:', JSON.stringify(box))

  // Draw a simple zigzag "signature" using real mouse move events
  const startX = box.x + 20
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const points = [
    [box.x + 40, box.y + 20],
    [box.x + 70, box.y + box.height - 20],
    [box.x + 100, box.y + 20],
    [box.x + 130, box.y + box.height - 20],
    [box.x + 160, box.y + box.height / 2],
  ]
  for (const [x, y] of points) {
    await page.mouse.move(x, y, { steps: 5 })
  }
  await page.mouse.up()
  await page.waitForTimeout(500)

  await page.screenshot({ path: `${SHOT_DIR}/3-signature-drawn.png`, fullPage: true })

  // Check the canvas is actually non-empty by reading pixel data
  const isEmpty = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (!ctx) return true
    const data = ctx.getImageData(0, 0, el.width, el.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false // found a non-transparent pixel
    }
    return true
  })
  console.log('Canvas is empty after drawing (should be false):', isEmpty)

  // Submit the sign-off
  await page.click('button:has-text("Sign & Complete Job")')
  await page.waitForTimeout(2000)

  const bodyText = await page.locator('body').textContent()
  console.log('Shows validation error (should be false/null):', bodyText?.includes('Please have the customer'))
  console.log('Shows pending-sync state:', bodyText?.includes('Completed (pending sync)') || bodyText?.includes('Signed — syncing'))

  await page.screenshot({ path: `${SHOT_DIR}/4-after-signoff-submit.png`, fullPage: true })

  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
