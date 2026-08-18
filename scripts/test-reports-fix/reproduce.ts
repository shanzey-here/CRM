import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'

async function testTenant(email: string, password: string, label: string) {
  console.log(`\n\n========== ${label} (${email}) ==========`)
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(60000)

    page.on('console', (m) => console.log(`[console:${m.type()}]`, m.text().slice(0, 300)))
    page.on('pageerror', (e) => console.log('[pageerror]', e.message))
    page.on('requestfinished', async (r) => {
      if (r.method() === 'POST' && r.url().includes('/office/reports')) {
        const resp = await r.response()
        const body = await resp?.text().catch(() => '<no body>')
        console.log(`[POST ${r.url()}] status=${resp?.status()} body=${body?.slice(0, 800)}`)
      }
    })
    page.on('requestfailed', (r) => {
      console.log(`[REQUEST FAILED] ${r.method()} ${r.url()} - ${r.failure()?.errorText}`)
    })

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
      page.click('button[type="submit"]'),
    ])
    await page.waitForTimeout(1500)

    const navStart = Date.now()
    await page.goto(`${BASE}/office/reports`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    console.log(`Navigation completed in ${Date.now() - navStart}ms`)

    // Take screenshots at multiple points to see real progression
    for (const delay of [2000, 5000, 10000, 20000]) {
      await page.waitForTimeout(delay === 2000 ? 2000 : delay - (delay === 5000 ? 2000 : delay === 10000 ? 5000 : 10000))
      const spinnerCount = await page.locator('.animate-spin').count()
      const bodyText = await page.locator('body').textContent()
      console.log(`[t+${delay}ms] Spinners visible: ${spinnerCount} | Contains "Total Leads": ${bodyText?.includes('Total Leads')} | Contains "not available on your current plan": ${bodyText?.includes('not available on your current plan')} | Contains error text: ${bodyText?.includes('Failed to load')}`)
    }

    await page.screenshot({ path: `D:/CRM/scripts/test-reports-fix/${label.replace(/\s+/g, '-')}.png`, fullPage: true })
  } finally {
    await browser.close()
  }
}

async function main() {
  await testTenant('admin@devtest.local', 'DevTest123!', 'entitled-tenant')
  await testTenant('admin-freetier@workflowtest.local', 'DevTest123!', 'unentitled-tenant')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
