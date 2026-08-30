// Unit test for § 2A of PHASE4_CONFIRM_BOOKING_DECISION.md:
// "one retry of updateLeadStage, but skip it if the stage is already correct".
// Pure logic — no Next request context, no DB.
import { retryStageAdvance } from '../src/modules/leads/server/stage-retry'

let failures = 0
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

async function run() {
  console.log('=== § 2A retryStageAdvance ===\n')

  // 1. First attempt succeeds → no retry, no skip.
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'confirmed_booking',
      attempt: async () => { calls++; return { success: true } },
      currentStage: async () => { throw new Error('currentStage should NOT be read on success') },
    })
    check('happy path: 1 attempt, result success', r.attempts === 1 && r.result.success === true)
    check('happy path: stage never re-read', calls === 1 && r.skipped === false)
  }

  // 2. First attempt fails, stage is ALREADY correct (lost-response edge case)
  //    → skip the retry, report success, do NOT call attempt again.
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'confirmed_booking',
      attempt: async () => { calls++; return { success: false, error: 'transient' } },
      currentStage: async () => 'confirmed_booking',
    })
    check('lost-response: attempt called exactly once (no duplicate)', calls === 1, `calls=${calls}`)
    check('lost-response: reported as success', r.result.success === true)
    check('lost-response: skipped flag set', r.skipped === true && r.attempts === 1)
  }

  // 3. First attempt fails, stage NOT yet correct → retry once.
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'confirmed_booking',
      attempt: async () => { calls++; return calls === 2 ? { success: true } : { success: false, error: 'blip' } },
      currentStage: async () => 'quote_sent',
    })
    check('transient blip: retried once and then succeeded', calls === 2 && r.attempts === 2)
    check('transient blip: result success, not skipped', r.result.success === true && r.skipped === false)
  }

  // 4. First attempt fails, stage not correct, retry ALSO fails → surface failure
  //    (confirmBookingAction turns this into the specific § 2A warning).
  {
    let calls = 0
    const r = await retryStageAdvance({
      target: 'confirmed_booking',
      attempt: async () => { calls++; return { success: false, error: 'still down' } },
      currentStage: async () => 'quote_sent',
    })
    check('hard failure: attempted twice', calls === 2 && r.attempts === 2)
    check('hard failure: result is failure (→ warning path)', r.result.success === false)
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
