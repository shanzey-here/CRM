import { CalendarEvent } from '../src/modules/calendar/server/repository'
import { computeConflicts } from '../src/modules/calendar/conflict'

function runTest() {
  console.log('--- Running Calendar Conflict Indicator Test ---')
  
  const userA = 'crew-user-123'
  const userB = 'crew-user-456'

  // Mock Calendar Events
  const events: CalendarEvent[] = [
    {
      id: 'job1',
      type: 'job',
      title: 'Job 1',
      start_time: '2026-08-15T09:00:00Z',
      end_time: '2026-08-15T12:00:00Z',
      status: 'scheduled',
      assigned_to: [userA, userB],
      raw_data: {}
    },
    {
      id: 'appt1',
      type: 'appointment',
      title: 'Overlapping Appointment for User A',
      start_time: '2026-08-15T11:00:00Z',
      end_time: '2026-08-15T13:00:00Z',
      status: 'scheduled',
      assigned_to: [userA], // userA is also on job1, overlapping time!
      raw_data: {}
    },
    {
      id: 'appt2',
      type: 'appointment',
      title: 'Non-Overlapping Appointment for User B',
      start_time: '2026-08-15T13:00:00Z',
      end_time: '2026-08-15T14:00:00Z',
      status: 'scheduled',
      assigned_to: [userB], // After job1 finishes
      raw_data: {}
    },
    {
      id: 'appt3',
      type: 'appointment',
      title: 'Overlapping Appointment for Unassigned User',
      start_time: '2026-08-15T10:00:00Z',
      end_time: '2026-08-15T11:00:00Z',
      status: 'scheduled',
      assigned_to: ['other-user'], // Overlaps time, but different user
      raw_data: {}
    }
  ]

  const computed = computeConflicts(events as any)

  let failed = false

  // 1. appt1 should have conflict
  const appt1 = computed.find((e: any) => e.id === 'appt1')
  if (!appt1?.hasConflict) {
    console.error('FAIL: appt1 should have a conflict because User A is assigned to job1 at the same time.')
    failed = true
  } else {
    console.log('PASS: Visual conflict indicator successfully fired for overlapping crew appointment.')
  }

  // 2. appt2 should not have conflict
  const appt2 = computed.find((e: any) => e.id === 'appt2')
  if (appt2?.hasConflict) {
    console.error('FAIL: appt2 should NOT have a conflict (different time).')
    failed = true
  } else {
    console.log('PASS: No false positive for adjacent appointment.')
  }

  // 3. appt3 should not have conflict
  const appt3 = computed.find((e: any) => e.id === 'appt3')
  if (appt3?.hasConflict) {
    console.error('FAIL: appt3 should NOT have a conflict (different user).')
    failed = true
  } else {
    console.log('PASS: No false positive for overlapping time but different crew.')
  }

  if (failed) {
    process.exit(1)
  }
}

runTest()
