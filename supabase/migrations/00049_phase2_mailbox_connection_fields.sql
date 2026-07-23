-- =============================================================================
-- Migration: 00049_phase2_mailbox_connection_fields.sql
-- Description: Fields needed to actually connect a mailbox (found missing
--              while implementing the connection flow, not present in the
--              original email-db schema)
-- =============================================================================
-- mailbox_address: the real email address (e.g. dispatcher@gmail.com) —
-- needed for display in Settings UI and for the sync worker to tell inbound
-- from outbound mail by comparing from_address against this value. Applies
-- to both OAuth and IMAP mailboxes.
--
-- imap_host/imap_port: only used when connection_method = 'imap_password'.
-- Not secrets (a mail server hostname/port is public information, unlike the
-- password) — stored in plain columns, not folded into encrypted_credential.
-- IMAP username is assumed to equal mailbox_address (true for virtually all
-- real-world providers); no separate username-override column in v1.

ALTER TABLE public.mailboxes
  ADD COLUMN mailbox_address text,
  ADD COLUMN imap_host text,
  ADD COLUMN imap_port integer;
