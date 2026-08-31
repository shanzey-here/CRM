import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function auditConfirmedBookings() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUDIT: LEADS (confirmed_booking) vs JOBS (scheduled)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Fetch all tenants
  const { data: tenants } = await supabase.from('tenants').select('id, name')
  console.log(`Found ${tenants?.length ?? 0} tenants.\n`)

  // 2. Fetch all leads at confirmed_booking
  const { data: confirmedLeads } = await supabase
    .from('leads')
    .select(`
      id,
      tenant_id,
      contact_id,
      stage,
      stage_id,
      preferred_move_date,
      created_at,
      contact:contacts(first_name, last_name, email)
    `)
    .eq('stage', 'confirmed_booking')

  console.log(`Total Leads at 'confirmed_booking' stage across all tenants: ${confirmedLeads?.length ?? 0}`)

  // 3. Fetch all jobs
  const { data: allJobs } = await supabase
    .from('jobs')
    .select(`
      id,
      tenant_id,
      job_number,
      status,
      move_date,
      start_time,
      quote_id,
      contact_id,
      created_at,
      contact:contacts(first_name, last_name, email),
      quote:quotes(id, quote_number, lead_id, status)
    `)

  const scheduledJobs = allJobs?.filter((j) => j.status === 'scheduled') ?? []
  console.log(`Total Jobs across all statuses: ${allJobs?.length ?? 0}`)
  console.log(`Total Jobs at 'scheduled' status: ${scheduledJobs.length}\n`)

  // Status breakdown of jobs
  const jobStatusCounts: Record<string, number> = {}
  allJobs?.forEach((j) => {
    jobStatusCounts[j.status] = (jobStatusCounts[j.status] || 0) + 1
  })
  console.log('Jobs status breakdown:', jobStatusCounts, '\n')

  // 4. Cross reference Leads -> Jobs
  console.log('--- Checking Leads at confirmed_booking -> Jobs Linkage ---')
  let leadsWithMatchingJob = 0
  let leadsWithoutJob = 0

  for (const lead of confirmedLeads ?? []) {
    // Find job linked via quote
    const linkedJob = allJobs?.find((j) => (j.quote as any)?.lead_id === lead.id || j.contact_id === lead.contact_id)
    if (linkedJob) {
      leadsWithMatchingJob++
      console.log(`  ✓ Lead ${lead.id} (${(lead.contact as any)?.first_name} ${(lead.contact as any)?.last_name}) -> Job ${linkedJob.job_number} (status: ${linkedJob.status}, move_date: ${linkedJob.move_date})`)
    } else {
      leadsWithoutJob++
      console.log(`  ⚠ Lead ${lead.id} (${(lead.contact as any)?.first_name} ${(lead.contact as any)?.last_name}) -> NO JOB FOUND!`)
    }
  }
  console.log(`Summary: ${leadsWithMatchingJob} confirmed leads have a linked job, ${leadsWithoutJob} do not.\n`)

  // 5. Cross reference Jobs -> Leads
  console.log('--- Checking Scheduled Jobs -> Leads Linkage ---')
  let scheduledJobsFromLeads = 0
  let scheduledJobsWithoutLead = 0

  for (const job of scheduledJobs) {
    const linkedLeadId = (job.quote as any)?.lead_id
    if (linkedLeadId) {
      const matchingLead = confirmedLeads?.find((l) => l.id === linkedLeadId)
      if (matchingLead) {
        scheduledJobsFromLeads++
        console.log(`  ✓ Scheduled Job ${job.job_number} -> Linked Lead ${linkedLeadId} (confirmed_booking)`)
      } else {
        // Find what stage the lead is actually at
        const { data: otherLead } = await supabase.from('leads').select('id, stage').eq('id', linkedLeadId).single()
        console.log(`  ⚠ Scheduled Job ${job.job_number} -> Linked Lead ${linkedLeadId} is at stage: '${otherLead?.stage}' (NOT confirmed_booking!)`)
      }
    } else {
      scheduledJobsWithoutLead++
      console.log(`  ℹ Scheduled Job ${job.job_number} (${(job.contact as any)?.first_name} ${(job.contact as any)?.last_name}) -> Standalone Manual Job (No lead / quote link)`)
    }
  }
  console.log(`\nSummary: ${scheduledJobsFromLeads} scheduled jobs linked to confirmed_booking leads, ${scheduledJobsWithoutLead} scheduled jobs are standalone manual jobs with no lead link.\n`)
}

auditConfirmedBookings().catch(console.error)
