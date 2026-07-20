import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { getUpcomingJobs } from '../src/modules/jobs/server/repository'
import { getPendingTasks } from '../src/modules/tasks/server/repository'
import { getLeadsNeedingFollowUp } from '../src/modules/leads/server/repository'
import { getOutstandingInvoices } from '../src/modules/invoicing/server/repository'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
// Use service key to bypass RLS for setup, but we'll use JWT for actual tests
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function runDashboardRepoTests() {
  console.log('--- Running Dashboard Repository Isolation Tests ---')

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const userA = '11111111-1111-1111-1111-111111111111'
  
  // Set up a Supabase client acting as user A in tenant A
  const supabaseA = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${await generateTestJwt(userA, tenantA, 'tenant_admin')}`
      }
    }
  })

  // 1. Test getUpcomingJobs
  console.log('Testing getUpcomingJobs...')
  // Try to get jobs for tenant B using tenant A's client
  const jobsRes = await getUpcomingJobs(supabaseA, tenantB)
  if (jobsRes.success && jobsRes.jobs!.length > 0) {
    console.error('❌ FAIL: getUpcomingJobs returned data for another tenant!')
    process.exit(1)
  }
  
  // Try to get jobs for tenant A using tenant A's client
  const jobsResA = await getUpcomingJobs(supabaseA, tenantA)
  if (!jobsResA.success) {
    console.error('❌ FAIL: getUpcomingJobs failed for own tenant:', jobsResA.error)
    process.exit(1)
  }
  console.log('✅ getUpcomingJobs isolation verified.')

  // 2. Test getPendingTasks
  console.log('Testing getPendingTasks...')
  const tasksRes = await getPendingTasks(supabaseA, tenantB)
  if (tasksRes.success && tasksRes.tasks!.length > 0) {
    console.error('❌ FAIL: getPendingTasks returned data for another tenant!')
    process.exit(1)
  }
  console.log('✅ getPendingTasks isolation verified.')

  // 3. Test getLeadsNeedingFollowUp
  console.log('Testing getLeadsNeedingFollowUp...')
  const leadsRes = await getLeadsNeedingFollowUp(supabaseA, tenantB)
  if (leadsRes.success && leadsRes.leads!.length > 0) {
    console.error('❌ FAIL: getLeadsNeedingFollowUp returned data for another tenant!')
    process.exit(1)
  }
  console.log('✅ getLeadsNeedingFollowUp isolation verified.')

  // 4. Test getOutstandingInvoices
  console.log('Testing getOutstandingInvoices...')
  const invoicesRes = await getOutstandingInvoices(supabaseA, tenantB)
  if (invoicesRes.success && invoicesRes.invoices!.length > 0) {
    console.error('❌ FAIL: getOutstandingInvoices returned data for another tenant!')
    process.exit(1)
  }
  console.log('✅ getOutstandingInvoices isolation verified.')

  console.log('🎉 All dashboard repository isolation tests passed!')
}

// Minimal JWT generator for testing
import * as crypto from 'crypto'
async function generateTestJwt(userId: string, tenantId: string, role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { tenant_id: tenantId, tenant_role: role }
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', process.env.SUPABASE_JWT_SECRET!)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

runDashboardRepoTests().catch(console.error)
