import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function checkRole(email: string, password: string, label: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  console.log(`\n=== ${label} ===`)
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2000)
    console.log(`  t=${(i + 1) * 2}s url=${page.url()}`)
    if (page.url() === `${BASE}/office`) break
  }

  const finalUrl = page.url()
  console.log('FINAL URL:', finalUrl)
  if (finalUrl === `${BASE}/office`) {
    const bodyText = await page.textContent('body')
    console.log('Body sample:', bodyText?.replace(/\s+/g, ' ').slice(0, 150))
  }

  await browser.close()
}

async function main() {
  await checkRole('admin@devtest.local', 'DevTest123!', 'tenant_admin landing page')
  await checkRole('dispatcher@devtest.local', 'DevTest123!', 'dispatcher landing page')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
