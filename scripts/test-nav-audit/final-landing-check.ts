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
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])

  // Now separately, explicitly navigate to the root "/" as a real top-level
  // navigation, and let Playwright follow the FULL server-side redirect
  // chain to completion (goto only resolves once the final response lands).
  const response = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  console.log(`\n=== ${label} ===`)
  console.log('Final URL after full redirect chain:', page.url())
  console.log('Final response status:', response?.status())
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
