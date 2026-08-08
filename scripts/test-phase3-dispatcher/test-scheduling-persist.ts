import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
  page.setDefaultTimeout(90000)
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console error]', m.text().slice(0, 150)) })
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/office/scheduling')) {
      const body = await r.text().catch(() => '')
      console.log('[POST response]', r.status(), body.slice(0, 500))
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
  await page.goto(`${BASE}/office/scheduling?date=2026-08-15`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const poolBefore = await page.locator('text=/require assignment/').textContent()
  console.log('BEFORE:', poolBefore)

  const jobCard = page.locator('div.bg-white.p-3.rounded-md.border.shadow-sm').first()
  const cardBox = await jobCard.boundingBox()
  const targetCell = page.locator('.flex-1.border-r.transition-colors').first()
  const targetBox = await targetCell.boundingBox()

  if (cardBox && targetBox) {
    const startX = cardBox.x + cardBox.width / 2
    const startY = cardBox.y + cardBox.height / 2
    const endX = targetBox.x + targetBox.width / 2
    const endY = targetBox.y + targetBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.waitForTimeout(100)
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(startX + ((endX - startX) * i) / 15, startY + ((endY - startY) * i) / 15)
      await page.waitForTimeout(40)
    }
    await page.mouse.up()
    console.log('Drag released, waiting for Server Action response...')
    await page.waitForTimeout(4000)
  }

  const errorToastText = await page.locator('text=/Failed to assign/').textContent().catch(() => null)
  console.log('Error toast text (if any):', errorToastText)

  const poolAfterDrag = await page.locator('text=/require assignment/').textContent()
  console.log('AFTER DRAG (before refresh):', poolAfterDrag)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const poolAfterRefresh = await page.locator('text=/require assignment/').textContent()
  console.log('AFTER REFRESH:', poolAfterRefresh)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
