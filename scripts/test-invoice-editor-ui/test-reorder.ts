import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 60000 })

  await page.goto(`${BASE}/office/settings/invoice-template`, { waitUntil: 'networkidle', timeout: 60000 })

  const blockLabels = () => page.locator('.p-3.bg-slate-50 span.font-medium').allTextContents()
  console.log('Block order BEFORE drag:', JSON.stringify(await blockLabels()))

  const handles = page.locator('[aria-label="Drag to reorder"]')
  const firstHandle = handles.first()
  const secondHandle = handles.nth(1)

  const firstBox = await firstHandle.boundingBox()
  const secondBox = await secondHandle.boundingBox()
  if (!firstBox || !secondBox) throw new Error('Could not locate drag handles')

  // Real pointer-event drag: dnd-kit's PointerSensor needs a real mouse down,
  // movement past its 8px activation distance, then release over the target.
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2 + 20, { steps: 5 })
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2 + 10, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)

  console.log('Block order AFTER drag:', JSON.stringify(await blockLabels()))

  await page.click('button:has-text("Save Invoice Template")')
  await page.waitForTimeout(1500)
  await page.reload({ waitUntil: 'networkidle' })
  console.log('Block order AFTER save + reload (real persistence):', JSON.stringify(await blockLabels()))

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
