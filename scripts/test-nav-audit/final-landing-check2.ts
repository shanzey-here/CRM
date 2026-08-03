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

  // First wait for genuine departure from /login (the click's own navigation),
  // then wait for the FINAL settled destination — the client-side redirect
  // chain can transiently pass through "/" before the middleware's second
  // hop lands on /office, and that second hop can be slow on a cold compile.
  await page.waitForURL((url: URL) => url.pathname !== '/login', { timeout: 30000 })
  await page.waitForURL((url: URL) => url.pathname === '/office', { timeout: 30000 })
  console.log(`\n=== ${label} ===`)
  console.log('Final settled URL:', page.url())
  const bodyText = await page.textContent('body')
  console.log('Visible heading/text sample:', bodyText?.replace(/\s+/g, ' ').slice(0, 200))

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
