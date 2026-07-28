import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

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
  console.log('Logged in, landed on:', page.url())

  await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Post to')
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/01-composer-loaded.png', fullPage: true })
  console.log('Composer loaded, screenshot saved')

  const content = `Real composer UI test — post now. ${new Date().toISOString()}`
  await page.fill('textarea[name="content"]', content)
  await page.check('input[type="checkbox"][value]')
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/01b-before-submit.png', fullPage: true })
  console.log('checkbox checked?', await page.isChecked('input[type="checkbox"][value]'))
  console.log('textarea value:', await page.inputValue('textarea[name="content"]'))
  // "Post now" radio is already the default selected value
  await page.click('button[type="submit"]:has-text("Post now")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/01c-after-click.png', fullPage: true })
  console.log('body text after click+3s:', (await page.locator('body').innerText()).slice(0, 800))

  await page.waitForSelector('text=Result — per account', { timeout: 30000 })
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/02-post-now-result.png', fullPage: true })

  const resultText = await page.locator('body').innerText()
  console.log('\n=== Page text after Post Now ===\n', resultText)

  await browser.close()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
