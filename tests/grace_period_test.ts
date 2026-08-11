import { isPastDueAccessExpired } from '../src/modules/subscriptions/server/grace-period'

console.log('--- Running past_due Grace Period Tests ---')

let passCount = 0
let failCount = 0

function report(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passCount++
    console.log(`PASS: ${name}`)
  } else {
    failCount++
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function daysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

const now = new Date('2026-08-10T12:00:00Z')

// Explicit null case — a tenant never past_due, or cleared back to active,
// must never be treated as expired.
report('null past_due_since -> false', isPastDueAccessExpired(null, now) === false)

// Boundary cases around the 7-day mark.
report('day 0 (just became past_due) -> false', isPastDueAccessExpired(daysAgo(0, now), now) === false)
report('day 6 (still in grace) -> false', isPastDueAccessExpired(daysAgo(6, now), now) === false)
report('day 6.99 (still in grace) -> false', isPastDueAccessExpired(daysAgo(6.99, now), now) === false)
report('day 7 exactly (grace expired) -> true', isPastDueAccessExpired(daysAgo(7, now), now) === true)
report('day 8 (well past grace) -> true', isPastDueAccessExpired(daysAgo(8, now), now) === true)
report('day 30 (long past grace) -> true', isPastDueAccessExpired(daysAgo(30, now), now) === true)

console.log(`\n${passCount} passed, ${failCount} failed`)
if (failCount > 0) process.exit(1)
