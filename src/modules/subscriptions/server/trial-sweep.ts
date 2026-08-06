import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Single source of truth for the warning window, shared by:
//   - the banner in src/app/office/layout.tsx
//   - the notification sweep below
// If this is ever changed, both the UI banner and the notification trigger
// update in lockstep automatically.
export const TRIAL_WARNING_DAYS = 3

// ---------------------------------------------------------------------------
// sweepExpiredTrials
// ---------------------------------------------------------------------------
// Transitions all `trialing` subscriptions whose current_period_end is in
// the past to `suspended`.
//
// IDEMPOTENCY: guaranteed by the `status = 'trialing'` filter — a row that is
// already `suspended` will never match the WHERE clause on a repeated run.
// No separate claimed-at guard is needed because this is a bulk set-based
// UPDATE (Postgres serialises concurrent writes; the second caller's WHERE
// simply matches nothing once the first has committed).
export async function sweepExpiredTrials(
  serviceClient: SupabaseClient<Database>
): Promise<{ processed: number; tenantIds: string[] }> {
  const nowIso = new Date().toISOString()

  const { data: expiredTrials, error: fetchErr } = await serviceClient
    .from('tenant_subscriptions')
    .select('id, tenant_id')
    .eq('status', 'trialing')
    .lt('current_period_end', nowIso)

  if (fetchErr) {
    throw new Error(`[TrialSweep] Failed to fetch expired trials: ${fetchErr.message}`)
  }

  if (!expiredTrials || expiredTrials.length === 0) {
    return { processed: 0, tenantIds: [] }
  }

  const expiredIds = expiredTrials.map((t) => t.id)

  const { error: updateErr } = await serviceClient
    .from('tenant_subscriptions')
    .update({ status: 'suspended', updated_at: nowIso })
    .in('id', expiredIds)

  if (updateErr) {
    throw new Error(`[TrialSweep] Failed to transition subscriptions to suspended: ${updateErr.message}`)
  }

  // The audit.log_action() trigger fires on UPDATE so this transition is
  // automatically logged against the service_role context.

  return {
    processed: expiredIds.length,
    tenantIds: expiredTrials.map((t) => t.tenant_id),
  }
}

// ---------------------------------------------------------------------------
// notifyApproachingTrials
// ---------------------------------------------------------------------------
// For every `trialing` subscription whose current_period_end is within the
// TRIAL_WARNING_DAYS window (but not yet expired), inserts a
// `trial_expiring_soon` notification targeted at every `tenant_admin` of
// that tenant.
//
// DE-DUPLICATION: uses an explicit dedup_key tied to
//   trial_expiring_soon:{tenant_id}:{user_id}:{current_period_end_iso}
// The `notifications.dedup_key` column has a UNIQUE constraint; the insert
// uses `ON CONFLICT (dedup_key) DO NOTHING` (via Supabase upsert
// ignoreDuplicates).  This guarantees at most one notification per
// (tenant admin, trial end date) regardless of how many times the sweep
// runs.  If a super admin later extends the trial, the new current_period_end
// value produces a fresh key, so a new warning fires when the renewed
// deadline enters the window.
//
// ERROR ISOLATION: a failure for any individual tenant is caught and logged;
// it NEVER propagates to the caller or aborts the sweep for other tenants.
// This matches the guarantee already established by generateNotifications()
// in src/modules/notifications/server/generator.ts.
export async function notifyApproachingTrials(
  serviceClient: SupabaseClient<Database>
): Promise<{ notified: number; skipped: number; errors: number }> {
  const nowIso = new Date().toISOString()
  const warningCutoffIso = new Date(
    Date.now() + TRIAL_WARNING_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  // 1. Find all trialing subscriptions within the warning window.
  const { data: approaching, error: fetchErr } = await serviceClient
    .from('tenant_subscriptions')
    .select('id, tenant_id, current_period_end')
    .eq('status', 'trialing')
    .gte('current_period_end', nowIso)           // not yet expired (those are handled by sweepExpiredTrials)
    .lte('current_period_end', warningCutoffIso) // within the warning window

  if (fetchErr) {
    console.error('[TrialSweep] Failed to fetch approaching trials:', fetchErr)
    return { notified: 0, skipped: 0, errors: 1 }
  }

  const rows = approaching ?? []
  let notified = 0
  let skipped = 0
  let errors = 0

  // 2. For each approaching subscription, notify tenant_admin users.
  //    Sequential (not parallel) for the same pacing rationale as the mailbox
  //    sync sweep — avoids hammering the DB with many concurrent writes.
  for (const sub of rows) {
    try {
      if (!sub.current_period_end) {
        skipped++
        continue
      }

      // Fetch all tenant_admin users for this tenant.
      const { data: admins, error: adminsErr } = await serviceClient
        .from('users')
        .select('id')
        .eq('tenant_id', sub.tenant_id)
        .eq('role', 'tenant_admin')

      if (adminsErr) {
        console.error(
          `[TrialSweep] Failed to fetch admins for tenant ${sub.tenant_id}:`,
          adminsErr
        )
        errors++
        continue
      }

      if (!admins || admins.length === 0) {
        skipped++
        continue
      }

      const daysRemaining = Math.ceil(
        (new Date(sub.current_period_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
      const expiryLabel =
        daysRemaining <= 0
          ? 'less than a day'
          : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`

      // One notification per admin user, each with its own dedup_key so that
      // all admins are notified and repeated sweeps skip all of them.
      const notificationsToInsert = admins.map((admin) => ({
        tenant_id: sub.tenant_id,
        target_user_id: admin.id,
        notification_type: 'trial_expiring_soon' as const,
        source_event_id: null as string | null,
        title: 'Your trial is expiring soon',
        message: `Your free trial expires in ${expiryLabel}. Upgrade now to keep access to all features.`,
        action_url: '/office/settings/billing',
        dedup_key: `trial_expiring_soon:${sub.tenant_id}:${admin.id}:${sub.current_period_end}`,
      }))

      // Insert-first idempotency: ON CONFLICT (dedup_key) DO NOTHING.
      // Already-notified admins are silently skipped; newly-added admins
      // receive the notification.
      const { error: insertErr } = await serviceClient
        .from('notifications')
        .upsert(notificationsToInsert, {
          onConflict: 'dedup_key',
          ignoreDuplicates: true,
        })

      if (insertErr) {
        console.error(
          `[TrialSweep] Failed to insert trial_expiring_soon notification for tenant ${sub.tenant_id}:`,
          insertErr
        )
        errors++
      } else {
        notified++
      }
    } catch (err: any) {
      // Ultimate safety net: individual tenant failure must never abort the
      // sweep for the remaining tenants.
      console.error(
        `[TrialSweep] Unexpected error processing approaching trial for tenant ${sub.tenant_id}:`,
        err
      )
      errors++
    }
  }

  return { notified, skipped, errors }
}
