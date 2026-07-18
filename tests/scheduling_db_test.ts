import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import { assignCrewToJob, assignVehicleToJob } from '../src/modules/scheduling/server/repository'
import { createVehicle } from '../src/modules/vehicles/server/repository'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Scheduling Database & Constraints Test ---')

  // 1. Setup Test Data
  const tenantId = '33333333-3333-3333-3333-333333333333'
  await supabase.from('tenants').upsert([{ id: tenantId, name: 'SchedTenant', slug: 'sched-tenant' }])

  // Setup crew user
  const { data: crewUser, error: uErr } = await supabase.from('users').insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    full_name: 'Crew Member',
    email: 'crew@test.com',
    role: 'crew'
  }).select().single()
  if (uErr) throw new Error(uErr.message)

  const { success: vSuccess, vehicle: vehicleData, error: vErr } = await createVehicle(supabase, tenantId, {
    name: 'Truck 1',
    type: 'Box Truck',
    capacity_cubic: 1000,
    is_active: true
  })
  if (!vSuccess) throw new Error(vErr)
  const vehicle = vehicleData!

  // Setup 2 Jobs
  const { data: contact, error: cErr } = await supabase.from('contacts').insert({ tenant_id: tenantId, first_name: 'Test', type: 'residential' }).select().single()
  if (cErr) throw new Error(cErr.message)
  const { data: job1, error: jErr1 } = await supabase.from('jobs').insert({ tenant_id: tenantId, contact_id: contact!.id, status: 'scheduled' }).select().single()
  if (jErr1) throw new Error(jErr1.message)
  const { data: job2, error: jErr2 } = await supabase.from('jobs').insert({ tenant_id: tenantId, contact_id: contact!.id, status: 'scheduled' }).select().single()
  if (jErr2) throw new Error(jErr2.message)

  // Time blocks
  const timeAStart = new Date('2026-08-01T08:00:00Z').toISOString()
  const timeAEnd   = new Date('2026-08-01T12:00:00Z').toISOString()
  const timeBStart = new Date('2026-08-01T11:00:00Z').toISOString() // Overlaps with Time A
  const timeBEnd   = new Date('2026-08-01T15:00:00Z').toISOString()
  const timeCStart = new Date('2026-08-01T13:00:00Z').toISOString() // Does not overlap with Time A
  const timeCEnd   = new Date('2026-08-01T17:00:00Z').toISOString()

  // 2. Test Success Case: Initial Assignment
  console.log('\nTesting Initial Assignments...')
  const initialCrew = await assignCrewToJob(supabase, tenantId, {
    job_id: job1!.id,
    user_id: crewUser!.id,
    scheduled_start: timeAStart,
    scheduled_end: timeAEnd
  })
  console.log('Initial Crew Assignment:', initialCrew.success ? 'Pass' : 'Fail')

  const initialVehicle = await assignVehicleToJob(supabase, tenantId, {
    job_id: job1!.id,
    vehicle_id: vehicle.id,
    scheduled_start: timeAStart,
    scheduled_end: timeAEnd
  })
  console.log('Initial Vehicle Assignment:', initialVehicle.success ? 'Pass' : 'Fail')

  // 3. Test Failure Case: Crew Double Booking
  console.log('\nTesting Crew Double Booking Block...')
  const crewDouble = await assignCrewToJob(supabase, tenantId, {
    job_id: job2!.id,
    user_id: crewUser!.id,
    scheduled_start: timeBStart,
    scheduled_end: timeBEnd
  })
  const crewBlocked = !crewDouble.success && crewDouble.error === 'This crew member is already assigned to an overlapping job.'
  console.log('Crew Double Booking Block:', crewBlocked ? 'Pass' : `Fail (${crewDouble.error})`)

  // 4. Test Failure Case: Vehicle Double Booking
  console.log('\nTesting Vehicle Double Booking Block...')
  const vehicleDouble = await assignVehicleToJob(supabase, tenantId, {
    job_id: job2!.id,
    vehicle_id: vehicle.id,
    scheduled_start: timeBStart,
    scheduled_end: timeBEnd
  })
  const vehicleBlocked = !vehicleDouble.success && vehicleDouble.error === 'This vehicle is already booked for an overlapping time.'
  console.log('Vehicle Double Booking Block:', vehicleBlocked ? 'Pass' : `Fail (${vehicleDouble.error})`)

  // 5. Test Success Case: Sequential Booking (Non-Overlapping)
  console.log('\nTesting Sequential Booking (Non-Overlapping)...')
  const vehicleSeq = await assignVehicleToJob(supabase, tenantId, {
    job_id: job2!.id,
    vehicle_id: vehicle.id,
    scheduled_start: timeCStart,
    scheduled_end: timeCEnd
  })
  console.log('Vehicle Sequential Booking:', vehicleSeq.success ? 'Pass' : `Fail (${vehicleSeq.error})`)

  // 6. Test Failure Case: Invalid Time Range
  console.log('\nTesting Invalid Time Range Check Constraint...')
  const invalidTime = await assignVehicleToJob(supabase, tenantId, {
    job_id: job2!.id,
    vehicle_id: vehicle.id,
    scheduled_start: timeCEnd,
    scheduled_end: timeCStart // End is BEFORE start
  })
  const timeBlocked = !invalidTime.success && invalidTime.error === 'Scheduled end time must be after the scheduled start time.'
  console.log('Invalid Time Check Block:', timeBlocked ? 'Pass' : `Fail (${invalidTime.error})`)

  // Cleanup
  await supabase.from('job_crew_assignments').delete().eq('tenant_id', tenantId)
  await supabase.from('job_vehicle_assignments').delete().eq('tenant_id', tenantId)
  await supabase.from('jobs').delete().in('id', [job1!.id, job2!.id])
  await supabase.from('contacts').delete().eq('id', contact!.id)
  await supabase.from('vehicles').delete().eq('id', vehicle.id)
  await supabase.from('users').delete().eq('id', crewUser!.id)
  await supabase.from('tenants').delete().eq('id', tenantId)

  console.log('\nDone.')
}

runTests().catch(console.error)
