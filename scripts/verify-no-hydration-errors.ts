import { chromium, type Browser } from '@playwright/test'

async function verifyNoHydrationErrors() {
  console.log('Testing /office/leads for hydration errors...')
  const browser: Browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const baseUrl = 'http://127.0.0.1:3000'

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // 1. Log in
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/login') && res.status() === 303, { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]')
  ])
  await page.waitForTimeout(2000)

  // 2. Navigate to /office/leads
  await page.goto(`${baseUrl}/office/leads`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('text=Leads Pipeline', { timeout: 30000 })
  await page.waitForTimeout(3000)

  const buttonNestingErrors = consoleErrors.filter((e) =>
    e.includes('cannot be a descendant of <button>') || e.includes('Hydration failed')
  )

  console.log(`Captured ${consoleErrors.length} total console errors.`)
  if (buttonNestingErrors.length > 0) {
    console.error('Hydration errors still present:', buttonNestingErrors)
    await browser.close()
    process.exit(1)
  }

  console.log('✓ 0 button nesting / hydration errors detected on /office/leads!')
  await browser.close()
}

verifyNoHydrationErrors().catch((err) => {
  console.error(err)
  process.exit(1)
})
