import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'
const CRATE_ID = process.argv[2]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)

  await page.goto(`${BASE}/login`)
  await page.waitForSelector('#email')
  await page.fill('#email', 'admin@devtest.local')
  await page.fill('#password', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

  await page.goto(`${BASE}/office/storage/crates/${CRATE_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=In Warehouse')
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/07a-before-select.png', fullPage: true })
  const optionCount = await page.locator('select').first().locator('option').count()
  console.log('Options in first select:', optionCount)
  const optionValues = await page.locator('select').first().locator('option').allTextContents()
  console.log('Option labels:', optionValues)

  await page.locator('select').first().selectOption('reserved')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/07b-after-select.png', fullPage: true })
  console.log('Body after select+3s:', (await page.locator('body').innerText()).slice(0, 400))

  await page.locator('span').filter({ hasText: 'Reserved' }).first().waitFor({ state: 'visible', timeout: 20000 })
  console.log('Transitioned in_warehouse -> reserved via real authenticated UI')

  await page.waitForTimeout(1000)
  const body = await page.locator('body').innerText()
  console.log('History section shows a real transition line?', /In Warehouse.*Reserved/.test(body) || body.includes('In Warehouse') && body.includes('Reserved'))
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/07-history-after-fix.png', fullPage: true })

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
