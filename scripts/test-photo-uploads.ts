import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { setupTestData } from './test-crew-runsheets'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTest() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000'

  console.log('Setting up test data...')
  
  const { jobA, crewA } = await setupTestData()
  const jobId = jobA
  const tenantId = '00000000-0000-0000-0000-000000000001'

  console.log('Logging in as Crew A...')
  await page.goto(`${baseUrl}/login`)
  await page.fill('input[name="email"]', 'crewa@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  
  await page.waitForSelector('text=Crew Dashboard', { timeout: 15000 })
  
  console.log(`Navigating to Run Sheet for Job ${jobId}...`)
  await page.goto(`${baseUrl}/crew/jobs/${jobId}`)
  
  try {
    await page.waitForSelector('text=Inventory to Move', { timeout: 10000 })
  } catch (err) {
    console.log('Timeout waiting for Inventory to Move. Taking screenshot...')
    await page.screenshot({ path: 'scripts/screenshots/photo-upload-error.png' })
    throw err
  }
  
  console.log('✓ Job sheet rendered')

  // Create a dummy image file for testing
  const dummyImagePath = path.join(__dirname, 'dummy.png')
  fs.writeFileSync(dummyImagePath, 'dummy image content')

  console.log('Disconnecting Network...')
  await context.setOffline(true)

  console.log('Taking two photos while offline...')
  // Photo 1
  await page.fill('input[placeholder*="Caption"]', 'Offline Photo 1')
  await page.setInputFiles('input[type="file"]', dummyImagePath)
  
  // Wait for it to appear in the pending queue
  await page.waitForSelector('text=Offline Photo 1', { timeout: 5000 })
  console.log('✓ Photo 1 queued')

  // Photo 2
  await page.fill('input[placeholder*="Caption"]', 'Offline Photo 2')
  await page.setInputFiles('input[type="file"]', dummyImagePath)
  
  await page.waitForSelector('text=Offline Photo 2', { timeout: 5000 })
  console.log('✓ Photo 2 queued')

  // Confirm pending upload count indicator
  const pendingText = await page.textContent('body')
  if (!pendingText?.includes('2 photo(s) pending upload')) {
    throw new Error('Pending queue indicator not showing 2 photos')
  }
  console.log('✓ Queue indicator shows 2 pending uploads')

  console.log('Simulating failure isolation (blocking Photo 1 upload)...')
  let upload1Blocked = false
  await page.route('**/storage/v1/object/job-photos/**', async route => {
    // If it's an upload request and we haven't blocked one yet, abort it
    if (route.request().method() === 'POST' && !upload1Blocked) {
      upload1Blocked = true
      await route.abort('failed')
    } else {
      await route.continue()
    }
  })

  console.log('Reconnecting Network...')
  await context.setOffline(false)

  // It should auto-sync because of the 'online' event listener
  console.log('Waiting for auto-sync to process...')
  
  // Wait for the failed state for photo 1
  await page.waitForSelector('text=failed', { timeout: 10000 })
  console.log('✓ Photo 1 successfully failed (isolated)')

  // Photo 2 should eventually disappear from the pending list (meaning it was successful)
  // Or it might move to the "uploaded" list. We wait for 'Offline Photo 2' to be in the uploaded list without 'Pending' or 'Failed'
  // But wait, the optimistic UI removes it from pending and it should appear as an uploaded photo.
  // Actually, we can check the database directly!
  
  let uploadedPhotos = []
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
      .eq('caption', 'Offline Photo 2')

    if (data && data.length > 0) {
      uploadedPhotos = data
      break
    }
    await page.waitForTimeout(1000)
    attempts++
  }

  if (uploadedPhotos.length === 0) {
    throw new Error('Photo 2 did not upload successfully after reconnecting!')
  }
  console.log('✓ Photo 2 successfully uploaded and isolated from Photo 1 failure!')
  
  // Cleanup
  fs.unlinkSync(dummyImagePath)
  
  // Clean up database photos for next run
  await supabase.from('job_photos').delete().eq('job_id', jobId)
  
  await browser.close()
  console.log('✅ All photo queue tests passed!')
}

runTest().catch(console.error)
