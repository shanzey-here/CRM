-- =============================================================================
-- Migration: 00050_mailbox_address_unique_for_reconnect.sql
-- Description: Support "Reconnect" updating the existing mailbox row
-- =============================================================================
-- Without this, reconnecting a broken mailbox (same address) via
-- createOAuthMailbox/createImapMailbox would insert a second row rather than
-- restore the existing one — leaving a stale is_active=false duplicate
-- alongside the new connection. UNIQUE(tenant_id, mailbox_address) lets the
-- repository upsert on that key instead.

ALTER TABLE public.mailboxes
  ADD CONSTRAINT mailboxes_tenant_address_unique UNIQUE (tenant_id, mailbox_address);
