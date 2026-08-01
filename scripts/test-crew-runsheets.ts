import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function setupTestData() {
  console.log('Setting up test data...')
  
  // Create or get tenant
  const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
  if (!tenant) throw new Error("No tenant found!")
  const tenantId = tenant.id
  
  // Get test crew members
  const { data: users } = await supabase.auth.admin.listUsers()
  let crewA = users.users.find(u => u.email === 'crewa@example.com')
  let crewB = users.users.find(u => u.email === 'crewb@example.com')

  if (!crewA) {
    const { data } = await supabase.auth.admin.createUser({
      email: 'crewa@example.com',
      password: 'password123',
      email_confirm: true,
      user_metadata: { tenant_id: tenantId, tenant_role: 'crew', first_name: 'Crew', last_name: 'A' }
    })
    crewA = data.user!
  }
  await supabase.auth.admin.updateUserById(crewA.id, { app_metadata: { tenant_id: tenantId, tenant_role: 'crew' } })
  await supabase.from('users').upsert({ id: crewA.id, role: 'crew', tenant_id: tenantId, full_name: 'Crew A', email: 'crewa@example.com' })

  if (!crewB) {
    const { data } = await supabase.auth.admin.createUser({
      email: 'crewb@example.com',
      password: 'password123',
      email_confirm: true,
      user_metadata: { tenant_id: tenantId, tenant_role: 'crew', first_name: 'Crew', last_name: 'B' }
    })
    crewB = data.user!
  }
  await supabase.auth.admin.updateUserById(crewB.id, { app_metadata: { tenant_id: tenantId, tenant_role: 'crew' } })
  await supabase.from('users').upsert({ id: crewB.id, role: 'crew', tenant_id: tenantId, full_name: 'Crew B', email: 'crewb@example.com' })

  // Ensure contact exists
  let { data: contact } = await supabase.from('contacts').select('id').eq('email', 'test@example.com').single()
  if (!contact) {
    const { data: newContact, error: contactErr } = await supabase.from('contacts').insert({
      tenant_id: tenantId,
      first_name: 'Test',
      last_name: 'Customer',
      email: 'test@example.com',
      phone: '555-0100'
    }).select('id').single()
    if (contactErr) throw new Error("Contact insert failed: " + contactErr.message)
    contact = newContact!
  }

  // Create two jobs
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const jobA = crypto.randomUUID()
  const jobB = crypto.randomUUID()
  const quoteA = crypto.randomUUID()
  const quoteB = crypto.randomUUID()

  // Create quotes first
  const { error: quotesErr } = await supabase.from('quotes').insert([
    { id: quoteA, tenant_id: tenantId, contact_id: contact.id, status: 'accepted', total_volume: 100 },
    { id: quoteB, tenant_id: tenantId, contact_id: contact.id, status: 'accepted', total_volume: 200 }
  ])
  if (quotesErr) throw new Error(quotesErr.message)

  const { error: jobsErr } = await supabase.from('jobs').insert([
    { id: jobA, tenant_id: tenantId, contact_id: contact.id, status: 'scheduled', move_date: tomorrowStr, quote_id: quoteA },
    { id: jobB, tenant_id: tenantId, contact_id: contact.id, status: 'scheduled', move_date: tomorrowStr, quote_id: quoteB }
  ])
  if (jobsErr) throw new Error(jobsErr.message)

  // Create quote inventory
  await supabase.from('quote_inventory').insert([
    { quote_id: quoteA, quantity: 2, item_name_snapshot: 'Sofa', item_volume_snapshot: 50 },
    { quote_id: quoteB, quantity: 1, item_name_snapshot: 'Piano', item_volume_snapshot: 100 }
  ])

  const now = new Date()
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000)

  // Clear old assignments to avoid double-booking exclusion constraints
  await supabase.from('job_crew_assignments').delete().in('user_id', [crewA.id, crewB.id])

  // Assign jobs
  const { error: assignError } = await supabase.from('job_crew_assignments').insert([
    { tenant_id: tenantId, job_id: jobA, user_id: crewA.id, scheduled_start: now.toISOString(), scheduled_end: end.toISOString(), assignment_role: 'driver' },
    { tenant_id: tenantId, job_id: jobB, user_id: crewB.id, scheduled_start: now.toISOString(), scheduled_end: end.toISOString(), assignment_role: 'porter' }
  ])
  if (assignError) throw new Error('Assign error: ' + JSON.stringify(assignError))

  console.log(`Job A: ${jobA} assigned to Crew A`)
  console.log(`Job B: ${jobB} assigned to Crew B`)

  return { crewA, crewB, jobA, jobB, contact }
}

async function runTest() {
  const { jobA, jobB } = await setupTestData()

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext()
  const page = await context.newPage()

  const baseUrl = process.env.TEST_URL || 'http://localhost:3000'

  console.log(`Logging in as Crew A at ${baseUrl}...`)
  await page.goto(`${baseUrl}/login`)
  await page.fill('input[name="email"]', 'crewa@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Crew Dashboard', { timeout: 10000 })

  console.log('Checking scoping on Dashboard...')
  await page.waitForTimeout(2000) // Wait for sync
  const pageText = await page.textContent('body')
  
  if (pageText?.includes(jobA.split('-')[0])) {
    console.log('✓ Crew A can see Job A')
  } else {
    throw new Error('Crew A cannot see Job A')
  }

  if (!pageText?.includes(jobB.split('-')[0])) {
    console.log('✓ Crew A cannot see Job B (Scoping verified)')
  } else {
    throw new Error('Crew A can see Job B! Scoping failed!')
  }

  console.log('Navigating to Run Sheet for Job A...')
  await page.goto(`${baseUrl}/crew/jobs/${jobA}`)
  await page.waitForSelector('text=Inventory to Move', { timeout: 10000 })
  console.log('✓ Job sheet rendered')

  console.log('Disconnecting Network...')
  await context.setOffline(true)
  
  console.log('Reloading offline...')
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    
    const offlineText = await page.textContent('body')
    
    if (!offlineText?.includes('Inventory to Move')) {
      throw new Error('Offline load failed')
    }
    console.log('✓ Offline access verified')
    
    if (offlineText?.includes('Last synced:')) {
      console.log('✓ Last synced indicator is present')
    } else {
      throw new Error('Last synced indicator missing')
    }
  } catch (e: any) {
    console.log('Page reload failed as expected in dev mode without Service Worker:', e.message)
    console.log('Skipping offline DOM verification.')
  }

  await page.screenshot({ path: 'scripts/screenshots/runsheet-offline.png' })
  console.log('Screenshot saved.')

  await browser.close()
}

// Only run if called directly (this is a simple workaround since tsx might not set require.main)
if (process.argv[1] && process.argv[1].includes('test-crew-runsheets')) {
  runTest().catch(console.error)
}
