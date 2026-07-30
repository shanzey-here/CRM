import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'
const PRIMARY_CONTACT_ID = process.argv[2]
const CONTROL_CONTACT_ID = process.argv[3]

async function loginAs(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 15000 })
  } catch {
    console.log('  (login did not redirect away from /login within 15s)')
  }
  await page.waitForTimeout(1000)
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // --- Primary contact as admin ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(20000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    console.log('Post-login URL:', page.url())

    await page.goto(`${BASE}/office/clients/${PRIMARY_CONTACT_ID}`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: 'scripts/test-relocation-history/screenshots/primary-contact.png', fullPage: true })
    console.log('\n=== PRIMARY CONTACT PAGE (admin) ===')
    console.log('URL:', page.url())
    const bodyText = await page.locator('body').innerText()
    console.log(bodyText)
    await page.close()
  }

  // --- Control contact as dispatcher (also confirms dispatcher role can view it) ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(20000)
    await loginAs(page, 'dispatcher@devtest.local', 'DevTest123!')
    console.log('Post-login URL (dispatcher):', page.url())

    await page.goto(`${BASE}/office/clients/${CONTROL_CONTACT_ID}`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: 'scripts/test-relocation-history/screenshots/control-contact.png', fullPage: true })
    console.log('\n=== CONTROL CONTACT PAGE (dispatcher) ===')
    console.log('URL:', page.url())
    const bodyText = await page.locator('body').innerText()
    console.log(bodyText)
    await page.close()
  }

  // --- Crew login attempting the same route ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(20000)
    await loginAs(page, 'crew@devtest.local', 'DevTest123!')
    console.log('\nPost-login URL (crew):', page.url())
    await page.goto(`${BASE}/office/clients/${PRIMARY_CONTACT_ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    console.log('Crew navigating to /office/clients/[primary] -> final URL:', page.url())
    await page.close()
  }

  // --- Customer login attempting the same route ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(20000)
    await loginAs(page, 'customer@devtest.local', 'DevTest123!')
    console.log('\nPost-login URL (customer):', page.url())
    await page.goto(`${BASE}/office/clients/${PRIMARY_CONTACT_ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    console.log('Customer navigating to /office/clients/[primary] -> final URL:', page.url())
    await page.close()
  }

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
