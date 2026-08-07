import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(30000)
  page.on('console', (m) => console.log('[console]', m.type(), m.text()))
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  page.on('request', (r) => { if (r.method() === 'POST') console.log('[REQUEST POST]', r.url()) })
  page.on('requestfailed', (r) => console.log('[REQUEST FAILED]', r.url(), r.failure()?.errorText))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin-freetier@workflowtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/office/workflows/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)

  await page.fill('#name', 'Debug save test 2')
  await page.locator('input[placeholder="e.g. Call customer"]').fill('Debug task title 2')
  await page.waitForTimeout(500)

  // Check element stacking at the button's location
  const box = await page.getByRole('button', { name: /Save Workflow/i }).boundingBox()
  console.log('Button box:', JSON.stringify(box))
  if (box) {
    const elAtPoint = await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y)
      return el ? el.outerHTML.slice(0, 300) : null
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    console.log('Element actually at that point:', elAtPoint)
  }

  console.log('\n--- Attempting click with force:true ---')
  await page.getByRole('button', { name: /Save Workflow/i }).click({ force: true })
  await page.waitForTimeout(1000)
  const btnTextRightAfter = await page.getByRole('button').filter({ hasText: /Save|Saving/ }).first().textContent().catch(() => 'N/A')
  console.log('Button text ~1s after click:', btnTextRightAfter)
  await page.waitForTimeout(5000)

  const bodyText = await page.locator('body').textContent()
  console.log('Contains "Upgrade to save":', bodyText?.includes('Upgrade to save'))
  console.log('URL:', page.url())

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
