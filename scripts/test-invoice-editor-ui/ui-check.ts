import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'
const INVOICE_ZERO_ID = process.argv[2]
const INVOICE_MULTI_ID = process.argv[3]

async function loginAs(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 60000 })
  } catch {
    console.log('  (login did not redirect away from /login within 60s)')
  }
  await page.waitForTimeout(1000)
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // --- 1+2. Editor: real edit persists + live preview reflects in-progress state ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/settings/invoice-template`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.screenshot({ path: 'scripts/test-invoice-editor-ui/screenshots/editor-initial.png', fullPage: true })
    console.log('=== EDITOR PAGE (initial) ===')
    console.log((await page.locator('body').innerText()).slice(0, 2000))

    // Toggle "Show tax breakdown" off on the totals_summary block
    const taxCheckbox = page.locator('label:has-text("Show tax breakdown") input[type="checkbox"]')
    await taxCheckbox.uncheck()

    // Edit footer custom text
    const footerTextInput = page.locator('input[type="text"]').last()
    await footerTextInput.fill('Thank you for choosing us — edited via real UI test.')

    await page.waitForTimeout(500)
    await page.screenshot({ path: 'scripts/test-invoice-editor-ui/screenshots/editor-in-progress.png', fullPage: true })
    console.log('\n=== LIVE PREVIEW (in-progress, unsaved) ===')
    const previewText = await page.locator('body').innerText()
    console.log('Preview shows edited footer text (unsaved):', previewText.includes('Thank you for choosing us — edited via real UI test.'))
    console.log('Preview no longer shows "Tax" row (tax breakdown toggled off):', !/Tax\s*£/.test(previewText))

    // Save
    await page.click('button:has-text("Save Invoice Template")')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'scripts/test-invoice-editor-ui/screenshots/editor-after-save.png', fullPage: true })
    const afterSaveText = await page.locator('body').innerText()
    console.log('\nSave success message shown:', afterSaveText.includes('updated successfully'))

    // Reload to confirm real persistence (not just optimistic local state)
    await page.reload({ waitUntil: 'networkidle' })
    const reloadedText = await page.locator('body').innerText()
    console.log('After RELOAD, footer text still shows the saved edit (real persistence):', reloadedText.includes('Thank you for choosing us — edited via real UI test.'))
    await page.close()
  }

  // --- 3+4. Real customer view: zero line items + multi line items ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'customer@devtest.local', 'DevTest123!')

    await page.goto(`${BASE}/customer/invoices`, { waitUntil: 'networkidle', timeout: 60000 })
    console.log('\n=== CUSTOMER INVOICE LIST ===')
    console.log(await page.locator('body').innerText())

    await page.goto(`${BASE}/customer/invoices/${INVOICE_ZERO_ID}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.screenshot({ path: 'scripts/test-invoice-editor-ui/screenshots/customer-invoice-zero.png', fullPage: true })
    console.log('\n=== CUSTOMER VIEW: ZERO LINE ITEMS INVOICE ===')
    console.log(await page.locator('body').innerText())

    await page.goto(`${BASE}/customer/invoices/${INVOICE_MULTI_ID}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.screenshot({ path: 'scripts/test-invoice-editor-ui/screenshots/customer-invoice-multi.png', fullPage: true })
    console.log('\n=== CUSTOMER VIEW: MULTI LINE ITEMS INVOICE ===')
    console.log(await page.locator('body').innerText())
    await page.close()
  }

  // --- 7a. crew cannot reach the office editor ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'crew@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/settings/invoice-template`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(1000)
    console.log('\nCrew navigating to /office/settings/invoice-template -> final URL:', page.url())
    await page.close()
  }

  // --- 7b. customer cannot reach the office editor ---
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'customer@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/settings/invoice-template`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(1000)
    console.log('Customer navigating to /office/settings/invoice-template -> final URL:', page.url())
    await page.close()
  }

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
