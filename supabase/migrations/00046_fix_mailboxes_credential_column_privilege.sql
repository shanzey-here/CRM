-- =============================================================================
-- Migration: 00046_fix_mailboxes_credential_column_privilege.sql
-- Description: Fix ineffective column-level REVOKE on mailboxes.encrypted_credential
-- =============================================================================
-- 00044's `REVOKE SELECT (encrypted_credential) ON mailboxes FROM authenticated`
-- did not actually restrict anything — verified empirically: a real
-- authenticated dispatcher session could still select the column. Root
-- cause: Supabase provisions a database-level default privilege (outside
-- this repo's migration history, applied at project bootstrap) granting
-- table-level SELECT on every public-schema table to `authenticated`. In
-- Postgres's ACL model, table-level and column-level privileges are
-- independent — revoking a column-level privilege that was never itself
-- explicitly granted does not narrow a pre-existing table-level GRANT that
-- already covers that column. A column-level REVOKE can only remove access
-- if access to that column was granted at the column level in the first
-- place.
--
-- Fix: revoke the table-level SELECT entirely from `authenticated` (and
-- `anon`, for symmetry — this table has no anon-facing use), then re-grant
-- SELECT on an explicit column allowlist that excludes encrypted_credential.
-- This is the "allowlist, not blocklist" pattern required to actually
-- restrict one column when the role otherwise has table-level access.
--
-- `admin_dispatcher_all`/`super_admin_all` RLS policies are unaffected — RLS
-- still governs which ROWS are visible; this migration only narrows which
-- COLUMNS of those visible rows the `authenticated` role can select.
-- service_role is untouched (bypasses grants/RLS entirely) — the future
-- sync worker still reads the real column via service_role, same as before.

REVOKE SELECT ON public.mailboxes FROM authenticated;
REVOKE SELECT ON public.mailboxes FROM anon;

GRANT SELECT (
  id, tenant_id, provider, connection_method, is_active, last_synced_at,
  created_at, updated_at
) ON public.mailboxes TO authenticated;

-- INSERT/UPDATE/DELETE go through the same RLS-governed table-level grants
-- other tenant tables use — this migration only touches SELECT, since that's
-- the vector that actually exposes stored ciphertext to a client.
GRANT INSERT, UPDATE, DELETE ON public.mailboxes TO authenticated;
