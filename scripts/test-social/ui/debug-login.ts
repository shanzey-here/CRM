import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))

  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('#email', 'admin@devtest.local')
  await page.fill('#password', 'DevTest123!')
  console.log('URL before submit:', page.url())
  await page.click('button[type="submit"]')
  await page.waitForTimeout(4000)
  console.log('URL 4s after submit:', page.url())
  const text = await page.locator('body').innerText()
  console.log('Body text snippet:', text.slice(0, 500))
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/debug-after-login.png', fullPage: true })
  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
