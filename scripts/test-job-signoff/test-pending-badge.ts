import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TEST_JOB_ID = '5622fae6-4417-4beb-a446-bddddb740a41'

async function main() {
  // Reset to a clean, unsigned state
  await supabase.from('job_signoffs').delete().eq('job_id', TEST_JOB_ID)
  await supabase.from('jobs').update({ status: 'scheduled' }).eq('id', TEST_JOB_ID)

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
  console.log('Jobs list BEFORE any signoff — real job visible:', beforeText?.includes(TEST_JOB_ID.split('-')[0]))
  console.log('Jobs list BEFORE any signoff — "Pending Sync" present (must be false):', beforeText?.includes('Pending Sync'))

  await page.goto(`http://localhost:3000/crew/jobs/${TEST_JOB_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('text=Job Sign-off', { timeout: 30000 })

  await context.setOffline(true)
  await page.fill('input[placeholder="John Doe"]', 'Badge Test Customer')
  const canvas = page.locator('canvas')
  await canvas.dragTo(canvas, { sourcePosition: { x: 10, y: 10 }, targetPosition: { x: 100, y: 50 } })
  await page.click('button:has-text("Sign & Complete Job")')
  await page.waitForSelector('text=Completed (pending sync)', { timeout: 15000 })
  console.log('✓ Signature queued locally while offline, detail page shows pending state')

  // Close THIS tab entirely before restoring connectivity — its
  // useSignoffSync 'online' listener dies with it, so there is no possible
  // race where it fires and syncs the signoff before we can check the
  // jobs list. Then open a fresh tab (same context = same IndexedDB/
  // cookies) that has never visited the detail page and thus never
  // attempted a sync.
  await page.close()
  await context.setOffline(false)

  const page2 = await context.newPage()
  page2.setDefaultTimeout(30000)
  await page2.goto('http://localhost:3000/crew', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page2.waitForSelector('text=Job ID:', { timeout: 30000 })
  await page2.waitForTimeout(500)

  const afterText = await page2.textContent('body')
  console.log('\n=== Jobs list page text (fresh tab, signoff still queued/unsynced) ===')
  console.log(afterText)
  console.log('\n"Pending Sync" badge present on jobs list (must be true):', afterText?.includes('Pending Sync'))
  console.log('Old raw status badge ("scheduled") NOT shown for this job (must be true — overlay replaces it):', !afterText?.includes('SCHEDULED'))

  const { data: jobDuring } = await supabase.from('jobs').select('status').eq('id', TEST_JOB_ID).single()
  console.log('Real DB status at check time (must still be scheduled, proving no sync occurred yet):', jobDuring?.status)

  await page2.screenshot({ path: 'scripts/test-job-signoff/pending-badge-jobs-list.png', fullPage: true })

  await browser.close()
  console.log('\n✅ Pending-sync badge test complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
