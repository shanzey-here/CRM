import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

async function checkAs(email: string, password: string) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)
  await page.goto(`${BASE}/login`)
  await page.waitForSelector('#email')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

  await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  console.log(`${email} -> final URL after requesting /office/social:`, page.url())
  const bodyText = await page.locator('body').innerText()
  console.log(`${email} -> page shows "Social" composer heading?`, bodyText.includes('Write a post'))
  await browser.close()
}

async function main() {
  await checkAs('crew@devtest.local', 'DevTest123!')
  await checkAs('customer@devtest.local', 'DevTest123!')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
