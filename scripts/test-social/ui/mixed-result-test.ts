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

  await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Post to')

  const content = `Mixed success/failure UI test. ${new Date().toISOString()}`
  await page.fill('textarea[name="content"]', content)

  const checkboxes = page.locator('input[type="checkbox"][value]')
  const count = await checkboxes.count()
  console.log('Account checkboxes found:', count)
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).click({ force: true })
  }
  for (let i = 0; i < count; i++) {
    console.log(`checkbox ${i} checked?`, await checkboxes.nth(i).isChecked())
  }

  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/03a-before-submit.png', fullPage: true })
  await page.click('button[type="submit"]:has-text("Post now")')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/03b-after-click.png', fullPage: true })
  console.log('body after click+5s:', (await page.locator('body').innerText()).slice(0, 600))
  await page.waitForSelector('text=Result — per account', { timeout: 30000 })
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/03-mixed-result.png', fullPage: true })

  const resultText = await page.locator('body').innerText()
  console.log('\n=== Page text after mixed-account Post Now ===\n', resultText)

  await browser.close()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
