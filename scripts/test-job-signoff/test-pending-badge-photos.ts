import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TEST_JOB_ID = '5622fae6-4417-4beb-a446-bddddb740a41'

async function main() {
  // Reset to a clean state and ensure job is visible today
  const todayStr = new Date().toISOString().split('T')[0]
  await supabase.from('job_photos').delete().eq('job_id', TEST_JOB_ID)
  await supabase.from('job_signoffs').delete().eq('job_id', TEST_JOB_ID)
  await supabase.from('jobs').update({ status: 'scheduled', move_date: todayStr }).eq('id', TEST_JOB_ID)

  // Create a dummy image for testing
  const dummyImagePath = path.join(__dirname, 'dummy.png')
  fs.writeFileSync(dummyImagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(30000)

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', 'crewa@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Crew Dashboard', { timeout: 30000 })
  console.log('✓ Logged in')

  await page.waitForSelector('text=Job ID:', { timeout: 30000 })
  const beforeText = await page.textContent('body')
  console.log('Jobs list BEFORE any photo — real job visible:', beforeText?.includes(TEST_JOB_ID.split('-')[0]))
  console.log('Jobs list BEFORE any photo — "Pending Sync" present (must be false):', beforeText?.includes('Pending Sync'))

  await page.goto(`http://localhost:3000/crew/jobs/${TEST_JOB_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('text=Job Photos', { timeout: 30000 })

  await context.setOffline(true)
  
  // Upload a photo
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' })
  await fileInput!.setInputFiles(dummyImagePath)
  
  // Wait for the photo to be queued
  await page.waitForSelector('text=1 photo(s) pending upload', { timeout: 15000 })
  console.log('✓ Photo queued locally while offline')

  // Close THIS tab entirely before restoring connectivity
  await page.close()
  await context.setOffline(false)

  const page2 = await context.newPage()
  page2.setDefaultTimeout(30000)
  await page2.goto('http://localhost:3000/crew', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page2.waitForSelector('text=Job ID:', { timeout: 30000 })
  await page2.waitForTimeout(1000) // Give IDB time to read and update state

  const afterText = await page2.textContent('body')
  console.log('\n=== Jobs list page text (fresh tab, photo still queued/unsynced) ===')
  console.log(afterText)
  console.log('\n"Pending Sync" badge present on jobs list (must be true):', afterText?.includes('Pending Sync'))

  await page2.screenshot({ path: 'scripts/test-job-signoff/pending-badge-jobs-list-photos.png', fullPage: true })

  fs.unlinkSync(dummyImagePath)
  await browser.close()
  
  if (!afterText?.includes('Pending Sync')) {
    throw new Error('TEST FAILED: "Pending Sync" badge was not found on the jobs list.')
  }
  
  console.log('\n✅ Pending-sync badge test (photos) complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
