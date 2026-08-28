import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'

async function main() {
  console.log('Launching browser to verify /office/social for admin@devtest.local...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // 1. Login as admin@devtest.local
    await page.goto(`${BASE}/login`)
    await page.fill('#email', 'admin@devtest.local')
    await page.fill('#password', 'DevTest123!')
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
    console.log('Logged in successfully, current URL:', page.url())

    // 2. Navigate to /office/social
    await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('h1:has-text("Social")', { timeout: 15000 })

    // Check if the plan banner is present
    const planBanner = await page.$('text=Social posting isn\'t available on your current plan')
    if (planBanner) {
      console.error('FAILED: Plan gating banner is still visible!')
    } else {
      console.log('SUCCESS: Plan gating banner is NOT present!')
    }

    // Check if composer form or account selector is visible
    const composerOrAccounts = await page.textContent('body')
    const hasPostTo = composerOrAccounts?.includes('Post to')
    const hasPostContent = composerOrAccounts?.includes('Post content')
    const hasNoAccounts = composerOrAccounts?.includes('No social accounts are connected yet')

    console.log('Composer check results:', {
      hasPostTo,
      hasPostContent,
      hasNoAccounts,
    })

    // Take screenshot
    await page.screenshot({ path: 'scripts/test-social/ui/screenshots/social-verified.png', fullPage: true })
    console.log('Screenshot saved to scripts/test-social/ui/screenshots/social-verified.png')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Verification error:', err)
  process.exit(1)
})
