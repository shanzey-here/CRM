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
  
  // Set window size for standard laptop
  await page.setViewportSize({ width: 1440, height: 900 })
  
  console.log('Logging in...')
  await page.goto('http://127.0.0.1:3000/login')
  
  // Need to log in. What are the dev credentials?
  // Previous scripts used 'admin@devtest.local' / 'testpass123'
  // I will try to login using form
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await page.click('button[type="submit"]')
  
  await page.waitForURL('http://127.0.0.1:3000/office')
  console.log('Logged in!')
  
  // 1. Dashboard
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'before-dashboard.png'), fullPage: true })
  console.log('Took dashboard screenshot')
  
  // 2. Leads Kanban
  await page.goto('http://127.0.0.1:3000/office/leads')
  await page.waitForTimeout(2000) // let leads fetch and render
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'before-kanban.png'), fullPage: true })
  console.log('Took kanban screenshot')
  
  // 3. Detail Page (Clients list -> Client detail)
  await page.goto('http://127.0.0.1:3000/office/clients')
  await page.waitForTimeout(2000)
  // Click the first row (we made them clickable earlier!)
  await page.click('tbody tr:first-child')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'before-detail.png'), fullPage: true })
  console.log('Took detail page screenshot')
  
  // 4. Settings Page
  await page.goto('http://127.0.0.1:3000/office/settings')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'before-settings.png'), fullPage: true })
  console.log('Took settings page screenshot')
  
  await browser.close()
}

run().catch(console.error)
