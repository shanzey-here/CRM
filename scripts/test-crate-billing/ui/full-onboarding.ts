import { chromium } from 'playwright'

const URL = process.argv[2]

async function shot(page: any, name: string) {
  await page.screenshot({ path: `scripts/test-crate-billing/ui/screenshots/${name}.png`, fullPage: true })
  console.log(`\n=== ${name} ===`)
  console.log('URL:', page.url())
  console.log((await page.locator('body').innerText()).slice(0, 1200))
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(20000)

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await shot(page, 'step1-phone')

  const frames = page.frames()
  console.log('Frame count:', frames.length, frames.map((f) => f.url()))
  const allButtons = await page.locator('button').allTextContents()
  console.log('All <button> texts on main frame:', JSON.stringify(allButtons))

  await page.click('button:has-text("Use test phone number")')
  await page.waitForTimeout(1000)
  await shot(page, 'step1b-after-testphone-click')

  await page.click('button[type="submit"], button:has-text("Submit")')
  await page.waitForTimeout(2500)
  await shot(page, 'step2')

  // Iterate: keep looking for "use test data"-style shortcuts and a
  // primary continue/submit button, clicking through up to N steps, since
  // the exact number/order of onboarding steps isn't known in advance.
  for (let i = 0; i < 8; i++) {
    const testDataButton = page.locator('button:has-text("Use test"), a:has-text("Use test")').first()
    if (await testDataButton.count() > 0) {
      console.log(`(step loop ${i}) clicking test-data shortcut`)
      await testDataButton.click()
      await page.waitForTimeout(800)
    }

    const continueButton = page.locator('button:has-text("Submit"), button:has-text("Continue"), button:has-text("Agree"), button:has-text("Save")').first()
    if (await continueButton.count() > 0) {
      console.log(`(step loop ${i}) clicking continue/submit`)
      await continueButton.click()
      await page.waitForTimeout(2500)
    } else {
      console.log(`(step loop ${i}) no continue button found, stopping loop`)
      break
    }

    await shot(page, `step-loop-${i}`)

    if (page.url().includes('127.0.0.1:3000')) {
      console.log('Reached our app — onboarding flow complete or redirected out.')
      break
    }
  }

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
