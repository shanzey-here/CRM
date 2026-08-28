import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'

async function main() {
  console.log('Starting Playwright test for enhanced Social UI (console hydration error check)...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  try {
    // 1. Login as admin@devtest.local
    await page.goto(`${BASE}/login`)
    await page.fill('#email', 'admin@devtest.local')
    await page.fill('#password', 'DevTest123!')
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
    console.log('Logged in successfully, URL:', page.url())

    // 2. Navigate to /office/social
    await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('h1:has-text("Social Media Hub")', { timeout: 15000 })
    console.log('Social Media Hub page loaded')

    await page.waitForTimeout(1000)

    const hydrationErrors = consoleErrors.filter(
      (e) => e.includes('hydration') || e.includes('cannot be a descendant') || e.includes('Hydration')
    )

    if (hydrationErrors.length > 0) {
      console.error('Hydration errors detected:', hydrationErrors)
      throw new Error(`Hydration error detected: ${hydrationErrors.join('\n')}`)
    } else {
      console.log('Zero hydration errors detected!')
    }

    // Capture clean screenshot
    await page.screenshot({
      path: 'scripts/test-social/ui/screenshots/enhanced-social-no-errors.png',
      fullPage: true,
    })
    console.log('Clean screenshot saved')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Playwright test failed:', err)
  process.exit(1)
})
