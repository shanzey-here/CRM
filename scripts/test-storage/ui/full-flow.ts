import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText))

  await page.goto(`${BASE}/login`)
  await page.waitForSelector('#email')
  await page.fill('#email', 'admin@devtest.local')
  await page.fill('#password', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  console.log('Logged in')

  // === 1. Create a real storage unit ===
  await page.goto(`${BASE}/office/storage/units`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Add a storage unit')
  const unitNumber = `UI-UNIT-${Date.now()}`
  await page.fill('input[placeholder="Unit number (e.g. A-101)"]', unitNumber)
  await page.fill('input[placeholder="Capacity (cubic ft)"]', '450')
  await page.click('button:has-text("Add unit")')
  // The success toast auto-hides after 3s (branding-form.tsx's exact
  // pattern) and dev-mode Fast Refresh can wipe local component state
  // during a background recompile — waiting for the real persisted row in
  // the table is the robust, meaningful check (proves real persistence,
  // not just a transient toast render).
  await page.waitForSelector(`text=${unitNumber}`, { timeout: 45000 })
  console.log('Storage unit created and persisted:', unitNumber)
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/01-unit-created.png', fullPage: true })

  // === 2. Create a real crate assigned to that unit ===
  await page.goto(`${BASE}/office/storage/crates/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Crate number')
  const crateNumber = `UI-CRATE-${Date.now()}`
  await page.fill('input[placeholder="e.g. CRATE-0042"]', crateNumber)
  await page.selectOption('select', { label: unitNumber })
  await page.click('button:has-text("Create crate")')
  await page.waitForURL(/\/office\/storage\/crates\/[a-f0-9-]+$/, { timeout: 45000 })
  const crateUrl = page.url()
  const crateId = crateUrl.split('/').pop()!
  console.log('Crate created:', crateNumber, 'id:', crateId)
  await page.waitForSelector('text=In Warehouse')
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/02-crate-detail-initial.png', fullPage: true })

  // === 3. Valid transition: in_warehouse -> reserved ===
  await page.selectOption('select:near(:text("Status"))', { label: 'Reserved' }).catch(async () => {
    // Fallback: the status-change select is the first <select> after the Status heading
    const selects = page.locator('select')
    await selects.first().selectOption('reserved')
  })
  await page.waitForSelector('text=Reserved', { timeout: 45000 })
  console.log('Transitioned: in_warehouse -> reserved')

  // === 4. Valid transition: reserved -> with_customer ===
  const statusSelects = page.locator('select')
  await statusSelects.first().selectOption('with_customer')
  await page.waitForSelector('text=With Customer', { timeout: 45000 })
  console.log('Transitioned: reserved -> with_customer')
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/03-with-customer.png', fullPage: true })

  // === 5. INVALID transition attempt: inject an out-of-band option into the
  // real status <select> (simulating a bypassed/tampered client — the
  // filtered dropdown never legitimately offers this) and select it,
  // firing the real onChange -> the real server action's real guard. ===
  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'))
    const statusSelect = selects[0]
    const opt = document.createElement('option')
    opt.value = 'reserved' // with_customer -> reserved is NOT in the allowed map
    opt.text = 'FORGED: reserved (invalid from with_customer)'
    statusSelect.appendChild(opt)
  })
  await page.locator('select').first().selectOption('reserved')
  await page.waitForTimeout(1500)
  const bodyAfterInvalid = await page.locator('body').innerText()
  console.log('Contains blocked-transition error message?', bodyAfterInvalid.includes('not a valid transition'))
  console.log('Still shows With Customer (status unchanged)?', bodyAfterInvalid.includes('With Customer'))
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/04-blocked-transition.png', fullPage: true })

  // === 6. Link to a real contact and a real job ===
  await page.click('text=+ Link to a contact or job')
  await page.fill('input[placeholder="Search contacts or jobs by customer name..."]', 'Alice')
  await page.waitForTimeout(1200)
  await page.click('button:has-text("Alice Devtest")')
  await page.waitForTimeout(1000)
  console.log('Linked contact')

  await page.click('text=+ Link to a contact or job')
  await page.fill('input[placeholder="Search contacts or jobs by customer name..."]', 'Alice')
  await page.waitForTimeout(1200)
  await page.click('button:has-text("2026-08-15")')
  await page.waitForTimeout(1000)
  console.log('Linked job')
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/05-linked.png', fullPage: true })

  const bodyAfterLink = await page.locator('body').innerText()
  console.log('Shows linked contact name?', bodyAfterLink.includes('Alice Devtest'))
  console.log('Shows linked job date?', bodyAfterLink.includes('2026-08-15'))

  // === 7. Valid path to in_warehouse: with_customer -> returned -> in_warehouse ===
  await page.locator('select').first().selectOption('returned')
  await page.waitForSelector('text=Returned', { timeout: 45000 })
  console.log('Transitioned: with_customer -> returned')

  await page.locator('select').first().selectOption('in_warehouse')
  await page.waitForSelector('text=In Warehouse', { timeout: 45000 })
  console.log('Transitioned: returned -> in_warehouse')
  await page.waitForTimeout(500)
  const bodyAfterReturn = await page.locator('body').innerText()
  console.log('Contact link cleared from UI?', !bodyAfterReturn.includes('Alice Devtest'))
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/06-back-in-warehouse.png', fullPage: true })

  console.log('\nCRATE_ID=' + crateId)

  await browser.close()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
