-- =============================================================================
-- Migration: 00052_phase2_mailbox_smtp_fields.sql
-- Description: SMTP connection details for sending via IMAP-connected mailboxes
-- =============================================================================
-- IMAP (reading) and SMTP (sending) are frequently different hosts/ports even
-- for the same account (e.g. imap.example.com:993 vs smtp.example.com:587) —
-- imap_host/imap_port cannot be safely guessed into an SMTP endpoint. Only
-- used when connection_method = 'imap_password'; Gmail sends via the Gmail
-- API, not SMTP. The existing encrypted_credential is reused as-is — the
-- same username/password serves both protocols for essentially every real
-- provider, so no second encrypted column is needed.

ALTER TABLE public.mailboxes
  ADD COLUMN smtp_host text,
  ADD COLUMN smtp_port integer;
