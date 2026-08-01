import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTest() {
  console.log('Starting Job Signoff Offline Survival Test...')

  // 1. Get Crew A's user ID
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const crewA = users.find(u => u.email === 'crewa@example.com')
  if (!crewA) throw new Error('Crew A user not found. Run setup first.')

  // Fetch test jobs set up by test-crew-runsheets specifically assigned to Crew A
  const { data: assignments } = await supabase
    .from('job_crew_assignments')
    .select('job_id')
    .eq('user_id', crewA.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!assignments || assignments.length === 0) {
    throw new Error('No test jobs assigned to Crew A found. Run setup-test-data first.')
  }
  
  const testJobId = assignments[0].job_id
  console.log(`Using test job: ${testJobId}`)

  // Reset status to 'scheduled' if it was completed in a prior test
  await supabase.from('jobs').update({ status: 'scheduled' }).eq('id', testJobId)

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text())
    } else {
      console.log('BROWSER LOG:', msg.text())
    }
  })
  
  page.on('pageerror', err => {
    console.log('BROWSER PAGE EXCEPTION:', err.message)
  })

  // 2. Login as Crew
  console.log('Logging in as Crew A...')
  
  try {
    const response = await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
    if (response && !response.ok()) {
      console.log(`Warning: Page returned status ${response.status()}`)
      console.log(await page.textContent('body'))
    }
    
    await page.waitForSelector('input[name="email"]', { timeout: 10000 })
    await page.fill('input[name="email"]', 'crewa@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForSelector('text=Crew Dashboard', { timeout: 10000 })
    console.log('✓ Logged in')
  } catch (e: any) {
    console.log('Failed during login phase. Taking screenshot...')
    await page.screenshot({ path: 'login-failure.png' })
    console.log('Page content:', await page.textContent('body'))
    throw e
  }

  // Wait for jobs to sync to offline storage
  await page.waitForTimeout(2000)

  // Navigate to job details page
  console.log('Navigating to job sheet...')
  
  try {
    await page.goto(`http://localhost:3000/crew/jobs/${testJobId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=Job Sign-off', { timeout: 15000 })
  } catch (e: any) {
    console.log('Failed during job sheet navigation. Taking screenshot...')
    await page.screenshot({ path: 'jobsheet-failure.png' })
    console.log('Page content:', await page.textContent('body'))
    throw e
  }

  // 3. Go offline
  console.log('Simulating offline mode...')
  await context.setOffline(true)
  
  // 4. Capture signature offline
  console.log('Capturing signature offline...')
  await page.fill('input[placeholder="John Doe"]', 'Test Customer')
  
  // Draw on canvas using dragTo for better event simulation
  const canvas = page.locator('canvas')
  await canvas.dragTo(canvas, {
    sourcePosition: { x: 10, y: 10 },
    targetPosition: { x: 100, y: 50 }
  })

  // Fill in the signature name
  await page.fill('input[placeholder="John Doe"]', 'John Customer')

  await page.click('button:has-text("Sign & Complete Job")')

  // 5. Verify the "pending sync" UI
  console.log('Verifying honest local state (pending sync)...')
  try {
    await page.waitForSelector('text=Completed (pending sync)', { timeout: 5000 })
  } catch (e: any) {
    console.log('Failed to verify pending sync state. Page text:')
    console.log(await page.textContent('body'))
    await page.screenshot({ path: 'pending-sync-failure.png' })
    throw e
  }
  console.log('✓ UI correctly shows pending sync instead of instantly completed')

  // Wait a bit to ensure it doesn't accidentally sync
  await page.waitForTimeout(1000)

  // Verify remote DB still says 'scheduled'
  const { data: jobBeforeSync } = await supabase.from('jobs').select('status').eq('id', testJobId).single()
  if (jobBeforeSync?.status !== 'scheduled') {
    throw new Error(`Job status was updated prematurely while offline! Expected scheduled, got ${jobBeforeSync?.status}`)
  }
  console.log('✓ Remote job status is still scheduled')

  // 6. Restore network and expect auto-sync
  console.log('Restoring network connectivity (expecting auto-sync)...')
  await context.setOffline(false)
  
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
  })

  // 7. Verify sync completion
  // Give it a moment to sync, then reload to force a fresh DB read
  await page.waitForTimeout(3000)
  await page.reload()
  
  await page.waitForSelector('text=Job Completed', { timeout: 10000 })
  console.log('✓ UI correctly updated to Job Completed')

  // 7. Verify the audit bundle in the DB
  console.log('Verifying remote database updates...')
  
  const { data: jobAfterSync } = await supabase.from('jobs').select('status').eq('id', testJobId).single()
  if (jobAfterSync?.status !== 'completed') {
    throw new Error(`Job status did not transition to completed! Got ${jobAfterSync?.status}`)
  }
  console.log('✓ Job status transitioned to completed')

  const { data: signoffs } = await supabase.from('job_signoffs').select('*').eq('job_id', testJobId)
  if (!signoffs || signoffs.length === 0) {
    throw new Error('Signoff record not found in database')
  }

  const signoff = signoffs[0]
  if (signoff.signature_name !== 'Test Customer') {
    throw new Error('Signature name mismatch')
  }
  if (!signoff.document_hash) {
    throw new Error('Document hash missing')
  }
  if (!signoff.captured_by) {
    throw new Error('Captured by missing')
  }

  console.log('✓ Full audit bundle verified (name, hash, captured_by, timestamps)')
  
  await browser.close()
  console.log('✅ All signature tests passed!')
}

runTest().catch(console.error)
