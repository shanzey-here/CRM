import { chromium } from 'playwright'

async function main() {
  console.log('launching...')
  const browser = await chromium.launch({ headless: true })
  console.log('launched, opening page...')
  const page = await browser.newPage()
  console.log('page opened, navigating...')
  const resp = await page.goto('http://127.0.0.1:3000/login', { timeout: 20000 })
  console.log('status:', resp?.status())
  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
