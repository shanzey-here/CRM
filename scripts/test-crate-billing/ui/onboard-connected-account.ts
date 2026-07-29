import { chromium } from 'playwright'

const URL = process.argv[2]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'scripts/test-crate-billing/ui/screenshots/onboard-current.png', fullPage: true })
  console.log('=== Current state ===')
  console.log('URL:', page.url())
  console.log((await page.locator('body').innerText()).slice(0, 1500))

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
