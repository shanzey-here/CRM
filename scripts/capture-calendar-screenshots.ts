import { chromium } from 'playwright'
import path from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function run() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    // 1. Login as Admin
    console.log('Logging in...')
    await page.goto(`${baseUrl}/login`)
    await page.fill('input[name="email"]', 'admin@devtest.local')
    await page.fill('input[name="password"]', 'DevTest123!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000) // Give it time to login
    
    console.log('Logged in successfully.')

    // 2. Navigate to Scheduling Calendar
    await page.goto(`${baseUrl}/office/scheduling?view=calendar`)
    await page.waitForSelector('.grid-cols-8') // Calendar grid
    
    // Screenshot 1: Unified Calendar
    await page.screenshot({ path: path.join(__dirname, 'screenshots', '1_unified_calendar.png') })
    console.log('Saved 1_unified_calendar.png')

    // Click Filter Panel
    await page.click('text=Manage View', { force: true })
    await page.waitForTimeout(2000)
    // Screenshot 2: Filter panel
    await page.screenshot({ path: path.join(__dirname, 'screenshots', '2_filter_panel.png') })
    console.log('Saved 2_filter_panel.png')

    // Switch to List View
    await page.goto(`${baseUrl}/office/scheduling?view=list`)
    await page.waitForTimeout(3000)
    // Screenshot 3: List View
    await page.screenshot({ path: path.join(__dirname, 'screenshots', '3_list_view.png') })
    console.log('Saved 3_list_view.png')

    // Navigate to Jobs New Page
    await page.goto(`${baseUrl}/office/jobs/new`)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(__dirname, 'screenshots', '4_jobs_new_page.png') })
    console.log('Saved 4_jobs_new_page.png')

    // We can also take a screenshot of the conflict if it exists
    await page.goto(`${baseUrl}/office/scheduling?view=calendar`)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(__dirname, 'screenshots', '5_conflict_indicator_or_calendar.png') })
    console.log('Saved 5_conflict_indicator_or_calendar.png')

  } catch (error) {
    console.error('Test Failed:', error)
  } finally {
    await browser.close()
  }
}

run()
