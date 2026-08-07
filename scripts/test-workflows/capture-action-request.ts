import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(30000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin-freetier@workflowtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/office/workflows/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  await page.fill('#name', 'Capture request test')
  await page.locator('input[placeholder="e.g. Call customer"]').fill('Capture task title')

  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && r.url() === `${BASE}/office/workflows/new`),
    page.getByRole('button', { name: /Save Workflow/i }).click(),
  ])

  console.log('URL:', request.url())
  console.log('Method:', request.method())
  console.log('Headers:', JSON.stringify(request.headers(), null, 2))
  console.log('PostData:', request.postData())

  const cookies = await page.context().cookies()
  console.log('\nCOOKIES_JSON:' + JSON.stringify(cookies))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
