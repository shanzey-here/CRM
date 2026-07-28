-- =============================================================================
-- Migration: 00053_grant_mailboxes_smtp_columns.sql
-- Description: Extend the authenticated column-grant allowlist for smtp_host/smtp_port
-- =============================================================================
-- Same class of gap fixed in 00051 for mailbox_address/imap_host/imap_port/
-- last_sync_error: mailboxes uses a column-level GRANT SELECT allowlist for
-- `authenticated` (not table-level), because encrypted_credential must stay
-- unreachable from any client-authenticated session (00046). GRANT SELECT
-- (col1, col2...) is a strict allowlist — a new table column does not
-- inherit it automatically. Adding smtp_host/smtp_port (00052) now, in the
-- same batch, rather than waiting to rediscover the identical bug the way
-- 00051 had to.

GRANT SELECT (smtp_host, smtp_port) ON public.mailboxes TO authenticated;
