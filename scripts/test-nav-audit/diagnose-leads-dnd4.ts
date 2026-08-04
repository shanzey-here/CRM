import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes('/office/leads')) {
      const body = await res.text().catch(() => '')
      if (body.includes('lead_id') || body.includes('"success"') && !body.includes('notification')) {
        netLog.push(`<< ${res.status()} body=${body.slice(0,300)}`)
      }
    }
  })

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

  // Drag from column 2 (Survey Scheduled, 1 card) into column 5 (Confirmed Booking, 1 card)
  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(1).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(4).locator('div.flex.flex-col.gap-2').first()
  const card = srcDropZone.locator('> div').first()
  const grip = card.locator('[aria-label="Drag to reorder"]')
  const gripBox = await grip.boundingBox()
  const dstBox = await dstDropZone.boundingBox()
  if (!gripBox || !dstBox) { console.log('missing boxes — dstBox likely off-screen, scrolling first'); await browser.close(); return }

  const startX = gripBox.x + gripBox.width/2, startY = gripBox.y + gripBox.height/2
  const endX = dstBox.x + dstBox.width/2, endY = dstBox.y + 60

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const steps = 20
  for (let i=1;i<=steps;i++){
    await page.mouse.move(startX + (endX-startX)*i/steps, startY + (endY-startY)*i/steps)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(300)
  const dstHighlight = await columns.nth(4).evaluate((el)=> (el as HTMLElement).style.boxShadow)
  console.log('Destination column boxShadow before drop:', JSON.stringify(dstHighlight))
  await page.mouse.up()
  await page.waitForTimeout(2000)

  console.log('Network calls matching lead-stage update pattern:', netLog.length ? netLog : '(none)')

  const counts = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
  console.log('Counts after drag (col2->col5):', JSON.stringify(counts))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
