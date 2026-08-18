// Pure gate function, same convention as resolveDraftOutcome/resolveLabelAutoApply
// — no I/O, directly unit-testable. Reads tenant_subscriptions.past_due_since,
// never updated_at (see the migration comment: updated_at resets on every
// webhook-driven touch, including Stripe's own dunning retries while already
// past_due — it would silently reset this clock and the bound would never
// actually trigger).
const PAST_DUE_GRACE_DAYS = 7

export function isPastDueAccessExpired(pastDueSince: string | null, now: Date = new Date()): boolean {
  // A tenant with no past_due_since — never past_due, or already cleared
  // back to active/paid — is never expired, regardless of any other state.
  if (pastDueSince === null) return false

  const elapsedMs = now.getTime() - new Date(pastDueSince).getTime()
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)

  return elapsedDays >= PAST_DUE_GRACE_DAYS
}
