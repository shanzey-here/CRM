import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(120000)

    page.on('pageerror', (e) => console.log('[pageerror]', e.message))
    page.on('requestfinished', async (r) => {
      if (r.method() === 'POST' && r.url().includes('/office/reports')) {
        const resp = await r.response()
        const body = await resp?.text().catch(() => '<no body>')
        console.log(`[t=${Date.now() - START}ms] [POST] status=${resp?.status()} body=${body?.slice(0, 500)}`)
      }
    })
    page.on('requestfailed', (r) => {
      console.log(`[t=${Date.now() - START}ms] [REQUEST FAILED] ${r.method()} ${r.url()} - ${r.failure()?.errorText}`)
    })

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', 'admin@devtest.local')
    await page.fill('input[type="password"]', 'DevTest123!')
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
      page.click('button[type="submit"]'),
    ])
    await page.waitForTimeout(1500)

    // Warm the route first (separate navigation) so cold-compile time doesn't confound the real timing
    await page.goto(`${BASE}/office/reports`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    console.log('First (warm-up) navigation done. Reloading fresh to time the real fetch...')

    var START = Date.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    console.log('Reload triggered at t=0. Waiting up to 90s for real POST responses...')

    await page.waitForTimeout(90000)

    const bodyText = await page.locator('body').textContent()
    console.log(`[FINAL @ 90s] Contains "Total Leads": ${bodyText?.includes('Total Leads')} | Spinners: ${await page.locator('.animate-spin').count()}`)
    await page.screenshot({ path: 'D:/CRM/scripts/test-reports-fix/entitled-tenant-90s.png', fullPage: true })
  } finally {
    await browser.close()
  }
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
