import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)

  for (const id of ['2d7c0305-ecba-4daf-ad83-507d27c74385', 'f44c83f8-93b1-456a-b65b-10d4b71b90de']) {
    await page.goto(`${BASE}/office/invoices/${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const bodyText = await page.locator('body').textContent()
    const hasEditButton = await page.getByRole('button', { name: 'Edit Invoice' }).isVisible().catch(() => false)
    console.log(`Invoice ${id}:`)
    console.log('  Edit Invoice button visible:', hasEditButton, '(must be false)')
    console.log('  Shows "already has a payment recorded" warning:', bodyText?.includes('already has a payment recorded against it'))
  }

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
