
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function run() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  await page.setViewportSize({ width: 1440, height: 900 })
  
  console.log('Logging in...')
  await page.goto('http://127.0.0.1:3000/login')
  
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')
  
  await page.waitForURL('http://127.0.0.1:3000/office')
  console.log('Logged in! Navigating to Leads...')
  
  await page.goto('http://127.0.0.1:3000/office/leads')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'after-leads.png'), fullPage: true })
  console.log('Took leads screenshot')
  
  await browser.close()
}

run().catch(console.error)

