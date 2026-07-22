-- =============================================================================
-- Migration: 00043_reconcile_tenant_suspend_columns.sql
-- Description: Retroactively track columns already live on tenant_subscriptions
-- =============================================================================
-- These two columns (manually_suspended, suspension_reason) were found live
-- on the shared dev database with no corresponding migration file anywhere in
-- git history — `supabase migration list --linked` showed remote "00043"
-- with no local match. Searched every branch (git branch -a, git grep across
-- all refs) for a file touching these column names or a tenant-suspend-
-- reactivate migration: none exists anywhere. Conclusion: they were applied
-- directly against the dev database outside the normal migration workflow
-- (e.g. via the Supabase SQL editor), not merged from an untracked branch.
--
-- This is schema tenant-suspend-reactivate will need — not reverting it, just
-- making git and the live database agree. Definitions below were confirmed
-- empirically against the live database, not guessed:
--   - `supabase gen types typescript` shows manually_suspended as non-nullable
--     in the Row type and optional in Insert (implies NOT NULL + a DEFAULT,
--     not nullable) and suspension_reason as nullable in both.
--   - All 41 existing rows have manually_suspended = false, suspension_reason
--     = null — consistent with DEFAULT false / DEFAULT NULL on ADD COLUMN
--     backfilling every existing row.
--   - Attempting to UPDATE a row's manually_suspended to NULL fails with
--     "null value in column "manually_suspended" ... violates not-null
--     constraint" — confirms NOT NULL.
--   - Attempting manually_suspended = true with suspension_reason still NULL
--     succeeds — confirms no CHECK constraint links the two columns.
--
-- IF NOT EXISTS makes this safe to run both here (where the columns already
-- exist — a no-op) and against a hypothetical fresh database built from
-- migration history alone (where it would actually create them).

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS manually_suspended boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS suspension_reason text;
