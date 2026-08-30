// Gap A — § 2A partial-failure handling for Schedule Survey.
//
// scheduleSurveyAction now reuses the SAME helper proven for Confirm Booking
// (src/modules/leads/server/stage-retry.ts) with target 'survey_scheduled':
// one retry of updateLeadStage, skipped if the stage is already correct.
//
// Pure logic — no Next request context, no DB. Same test approach as
// tests/confirm_booking_retry_test.ts.
import { retryStageAdvance } from '../src/modules/leads/server/stage-retry'

let failures = 0
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

async function run() {
  console.log('=== § 2A retryStageAdvance — target: survey_scheduled ===\n')

  // 1. Appointment created, first stage attempt succeeds → no retry, no skip.
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'survey_scheduled',
      attempt: async () => { calls++; return { success: true } },
      currentStage: async () => { throw new Error('currentStage must NOT be read on success') },
    })
    check('happy path: 1 attempt, success', r.attempts === 1 && r.result.success === true && calls === 1)
  }

  // 2. First attempt fails but the stage is ALREADY survey_scheduled
  //    (updateLeadStage persisted, response lost) → skip retry, report success,
  //    do NOT call attempt again (no duplicate "survey_scheduled → survey_scheduled").
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'survey_scheduled',
      attempt: async () => { calls++; return { success: false, error: 'transient' } },
      currentStage: async () => 'survey_scheduled',
    })
    check('lost-response: attempt called exactly once', calls === 1, `calls=${calls}`)
    check('lost-response: reported success, skipped flag set', r.result.success === true && r.skipped === true)
  }

  // 3. First attempt fails, stage not yet correct → retry once, then succeeds.
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'survey_scheduled',
      attempt: async () => { calls++; return calls === 2 ? { success: true } : { success: false, error: 'blip' } },
      currentStage: async () => 'inquiry',
    })
    check('transient blip: retried once and succeeded', calls === 2 && r.attempts === 2 && r.result.success === true)
  }

  // 4. First attempt fails, stage not correct, retry ALSO fails → surface failure.
  //    scheduleSurveyAction turns this into { success: true, warning: "...move it
  //    to Survey Scheduled manually" } and the form shows the § 2A panel.
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'survey_scheduled',
      attempt: async () => { calls++; return { success: false, error: 'still down' } },
      currentStage: async () => 'inquiry',
    })
    check('hard failure: attempted twice, result is failure (→ warning path)', calls === 2 && r.result.success === false)
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
