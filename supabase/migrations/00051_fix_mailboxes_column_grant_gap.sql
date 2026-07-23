-- =============================================================================
-- Migration: 00051_fix_mailboxes_column_grant_gap.sql
-- Description: Fix a real gap left by 00046's column-level privilege allowlist
-- =============================================================================
-- 00046 switched mailboxes from table-level SELECT to an explicit column
-- allowlist for `authenticated`, to keep encrypted_credential unreachable
-- (see that migration for the full reasoning). That allowlist necessarily
-- only listed the columns that existed at the time: id, tenant_id, provider,
-- connection_method, is_active, last_synced_at, created_at, updated_at.
--
-- Columns added afterward — mailbox_address, imap_host, imap_port (00049),
-- last_sync_error (00048, actually landed before 00046 but was already
-- missing from the original allowlist) — were never added to that grant.
-- GRANT SELECT (col1, col2, ...) is a strict allowlist; adding a new TABLE
-- COLUMN later does not implicitly extend an existing column-scoped GRANT.
--
-- Real-world effect, found via direct testing (not caught by any earlier
-- test in this branch, since those all used service_role, which bypasses
-- grants entirely): a real tenant_admin session querying the mailboxes page
-- got `permission denied for table mailboxes` on every request, silently
-- swallowed into an empty list by the page component (no error surfaced) —
-- the Settings UI has been unusable for real users despite every
-- service-role test passing throughout this branch's development.

GRANT SELECT (mailbox_address, imap_host, imap_port, last_sync_error) ON public.mailboxes TO authenticated;

-- encrypted_credential remains excluded — not touched by this migration.
