import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const SHOT_DIR = 'D:/CRM/scripts/test-crew-ui'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(120000)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('hydrated')) consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'customer@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/customer`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(15000)
  await page.screenshot({ path: `${SHOT_DIR}/9-customer-regression.png`, fullPage: true })
  console.log('Customer portal loaded OK. URL:', page.url())

  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
