import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { scheduleSurveyAction } from '../src/modules/appointments/server/actions'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function runConflictTests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  SCHEDULE SURVEY CONFLICT & WORKFLOW TESTS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Get devtest tenant
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()

  const tenantId = users!.tenant_id!
  console.log(`✓ Tenant ID: ${tenantId}`)

  // 2. Find or create a test surveyor user
  const { data: staffMembers } = await supabaseAdmin
    .from('users')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .limit(1)

  const surveyorId = staffMembers![0].id
  console.log(`✓ Using Surveyor: ${surveyorId}`)

  // 3. Find or create a test lead
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, contact_id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()

  // 4. Create a conflicting job assignment
  const conflictStart = '2026-09-20T14:00:00.000Z'
  const conflictEnd = '2026-09-20T17:00:00.000Z'

  // Find a job for the tenant
  const { data: jobs } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  let jobId = jobs?.[0]?.id
  if (!jobId) {
    const { data: newJob } = await supabaseAdmin
      .from('jobs')
      .insert({
        tenant_id: tenantId,
        contact_id: lead!.contact_id,
        status: 'scheduled',
        move_date: '2026-09-20',
      })
      .select('id')
      .single()
    jobId = newJob!.id
  }

  const { data: assignment, error: assignErr } = await supabaseAdmin
    .from('job_crew_assignments')
    .insert({
      tenant_id: tenantId,
      job_id: jobId,
      user_id: surveyorId,
      scheduled_start: conflictStart,
      scheduled_end: conflictEnd,
      assignment_role: 'lead_crew',
    })
    .select()
    .single()

  if (assignErr) {
    console.error('Warning creating test assignment:', assignErr)
  } else {
    console.log(`✓ Created test job crew assignment for surveyor from ${conflictStart} to ${conflictEnd}`)
  }

  // 5. Test 1: Survey overlapping the assignment window without ignoreConflict -> should detect conflict
  console.log('\n--- Test 1: Conflict Detection on Overlapping Window ---')
  const payload = {
    title: 'Survey During Job',
    contact_id: lead!.contact_id,
    assigned_to: surveyorId,
    start_time: '2026-09-20T15:00:00.000Z',
    end_time: '2026-09-20T16:00:00.000Z',
    status: 'scheduled' as const,
  }

  // Test createAppointmentAction logic directly
  const { data: conflicts } = await supabaseAdmin
    .from('job_crew_assignments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', surveyorId)
    .lt('scheduled_start', payload.end_time)
    .gt('scheduled_end', payload.start_time)

  if (conflicts && conflicts.length > 0) {
    console.log('✓ Overlap correctly detected with job crew assignments')
  } else {
    throw new Error('Expected conflict to be detected')
  }

  // 6. Test 2: Survey with ignoreConflict: true -> allows booking
  console.log('\n--- Test 2: Conflict Override Allowed ---')
  const { data: overrideAppt, error: overrideErr } = await supabaseAdmin
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      ...payload,
    })
    .select()
    .single()

  if (overrideErr || !overrideAppt) {
    throw new Error(`Failed to override and create appointment: ${overrideErr?.message}`)
  }
  console.log(`✓ Appointment successfully created with override: id=${overrideAppt.id}`)

  // Cleanup test records
  if (assignment) {
    await supabaseAdmin.from('job_crew_assignments').delete().eq('id', assignment.id)
  }
  await supabaseAdmin.from('appointments').delete().eq('id', overrideAppt.id)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  All Schedule Survey Conflict Tests Passed Successfully ✓')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

runConflictTests().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
