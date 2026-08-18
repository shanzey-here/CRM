-- =============================================================================
-- Migration: 00076_phase2_trial_expiry_notification_type.sql
-- Description: Add trial_expiring_soon notification type and dedup_key column
--              for insert-first idempotency on sweep-driven notifications.
-- =============================================================================

-- 1. Extend the notification_type_enum with the new trial warning type.
--    ADD VALUE cannot run inside a transaction block in Postgres < 14; on
--    Supabase (PG 15+) it is transactional, but IF NOT EXISTS is still safe
--    to re-run in case this migration is replayed against a state where it
--    was partially applied.
ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'trial_expiring_soon';

-- 2. Add dedup_key column for idempotent, insert-first notification generation.
--    The column is nullable so that all existing notification rows (which have
--    no dedup key) are unaffected.  A standard UNIQUE constraint on a nullable
--    column in Postgres allows arbitrarily many NULL values (NULLs are not
--    considered equal), so old rows with dedup_key = NULL coexist freely while
--    new rows with a non-NULL key are enforced unique.
--
--    Key format (set by the sweep): trial_expiring_soon:{tenant_id}:{user_id}:{current_period_end_iso}
--    This means: at most one notification per (tenant, admin user, trial end
--    date).  If the trial is extended by a super admin the new current_period_end
--    produces a distinct key, so a fresh warning fires when the renewed deadline
--    enters the warning window.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedup_key text;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_dedup_key_unique UNIQUE (dedup_key);

-- 3. Index for fast lookups of dedup_key (also implicit from the constraint,
--    but making it explicit here for documentation and the planner).
--    The constraint above already creates a B-tree index, so no separate
--    CREATE INDEX is needed.

-- Grants: INSERT is already handled by service_role (bypasses RLS).
-- No additional RLS policy changes needed — the existing SELECT/UPDATE
-- policies on notifications are unaffected by adding a column.
