// § 2A of PHASE4_CONFIRM_BOOKING_DECISION.md — "one retry, but skip it if the
// stage is already correct".
//
// Lives in its own Next-free module so it is unit-testable in isolation
// (tests/confirm_booking_retry_test.ts). `attempt` and `currentStage` are
// injected; confirmBookingAction passes the real updateLeadStage / getLeadById
// closures, a test passes fakes to drive every branch.

export type StageAdvanceResult = { success: true } | { success: false; error: string }

export async function retryStageAdvance<T extends string>(opts: {
  target: T
  attempt: () => Promise<StageAdvanceResult>
  currentStage: () => Promise<string | null | undefined>
}): Promise<{ result: StageAdvanceResult; attempts: number; skipped: boolean }> {
  const first = await opts.attempt()
  if (first.success) return { result: first, attempts: 1, skipped: false }

  // First attempt failed. If the stage is somehow already correct (the
  // "updateLead persisted but its response was lost" edge case), do NOT call
  // again — a second successful call would emit a second stage-change event
  // and log a nonsensical "confirmed_booking → confirmed_booking" entry.
  const stageNow = await opts.currentStage()
  if (stageNow === opts.target) {
    return { result: { success: true }, attempts: 1, skipped: true }
  }

  const second = await opts.attempt()
  return { result: second, attempts: 2, skipped: false }
}
