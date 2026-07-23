-- =============================================================================
-- Migration: 00044_phase2_email_db.sql
-- Description: Phase 2 — AI email assistant foundational schema (SCHEMA ONLY)
-- =============================================================================
-- No IMAP sync, no OAuth flow, no AI drafting logic here. Those belong to
-- email-imap-sync and ai-email-draft respectively. This migration only
-- settles the data model those branches will build on top of.
--
-- Four-mode ai_quoting_mode design (see tenant_settings section below):
--   off          — no AI involvement.
--   assist       — AI may auto-send replies to routine, non-committal
--                  messages; any reply carrying a priced quote is always
--                  held for human review, regardless of how routine the
--                  rest of the conversation felt (gate is on the action,
--                  not the conversation).
--   quote_review — AI drafts every reply, but ALL drafts are held for
--                  human approval — no auto-send path in this mode.
--   auto_send    — AI handles the whole conversation end-to-end, including
--                  quotes, no human review step.
-- In every mode a human can author a message directly at any time —
-- authored_by/requires_approval are per-message facts, not a thread-level
-- or tenant-level exclusivity switch. This schema does not enforce or
-- derive requires_approval from ai_quoting_mode; that decision belongs to
-- the future ai-email-draft branch. The only schema-level guarantee here is
-- the CHECK on email_messages below: requires_approval can only be true
-- alongside authored_by = 'ai_draft_pending' (pure data-integrity guard).
--
-- Future integration point (noted, not built): once email-imap-sync exists,
-- an inbound message landing should call the existing
-- emit_domain_event('email.received', 'email', payload) — same mechanism
-- already proven for lead.created/quote.accepted (see
-- 00007_phase1_leads_fix_emit_domain_event.sql for the current signature:
-- emit_domain_event(p_event_type text, p_source_module text,
-- p_payload jsonb DEFAULT '{}'::jsonb, p_tenant_id uuid DEFAULT NULL)).
-- No trigger or call site is added in this migration.

BEGIN;

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE mailbox_provider AS ENUM ('gmail', 'outlook', 'imap_generic');
-- More providers can be added later via ALTER TYPE ... ADD VALUE.

CREATE TYPE mailbox_connection_method AS ENUM ('oauth', 'imap_password');

CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');

CREATE TYPE email_authored_by AS ENUM ('human', 'ai_draft_pending', 'ai_sent');

CREATE TYPE ai_quoting_mode AS ENUM ('off', 'assist', 'quote_review', 'auto_send');

-- =============================================================================
-- 2. mailboxes — per-tenant connected inbox
-- =============================================================================
-- Credential security (resolved design, see PR discussion):
--   - OAuth preferred (encrypted_credential holds a refresh token).
--   - Raw IMAP password is an explicit fallback (encrypted_credential holds
--     the password instead), never plaintext.
--   - Single `encrypted_credential bytea` column regardless of method —
--     encrypted via pgcrypto's pgp_sym_encrypt (extension already enabled in
--     00001_phase0_foundations.sql for gen_random_uuid()). OAuth-specific
--     fields (client_id, scope, token expiry) are deliberately NOT added
--     here — email-imap-sync designs those when it builds the real flow.
--   - Key management (where the passphrase used with pgp_sym_encrypt lives —
--     env var, Supabase Vault, KMS) is explicitly deferred to
--     email-imap-sync. No passphrase is hardcoded anywhere in this
--     migration; that would itself be a secret committed to version control.
--   - RLS is NOT the only protection for this column: row-level RLS below
--     controls which rows a session can reach at all; a column-level
--     REVOKE SELECT (encrypted_credential) FROM authenticated (below) means
--     even a legitimate tenant_admin/dispatcher session cannot select this
--     column's bytes through PostgREST — only service_role (the future sync
--     worker) can. Encryption on top of that protects the value even if
--     both of those were ever bypassed (compromised service-role key, a
--     future overly-permissive policy change, a SQL-injection bug).
--   - Consequence for future app code: any SELECT on mailboxes from
--     authenticated/tenant-scoped code must name columns explicitly and
--     exclude encrypted_credential — `select('*')` will error for that role.

CREATE TABLE public.mailboxes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider              mailbox_provider NOT NULL,
  connection_method     mailbox_connection_method NOT NULL,
  encrypted_credential  bytea,
  is_active             boolean NOT NULL DEFAULT true,
  last_synced_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,

  CONSTRAINT mailboxes_tenant_unique UNIQUE (id, tenant_id)
);

CREATE INDEX idx_mailboxes_tenant_id ON public.mailboxes(tenant_id);

-- =============================================================================
-- 3. email_threads — a conversation
-- =============================================================================

CREATE TABLE public.email_threads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mailbox_id            uuid NOT NULL,
  contact_id            uuid,
  lead_id               uuid,
  subject               text,
  participant_addresses text[],
  last_message_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_threads_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT email_threads_mailbox_fk FOREIGN KEY (mailbox_id, tenant_id)
    REFERENCES public.mailboxes(id, tenant_id),
  -- Optional links, same nullable composite-FK pattern as tasks (00001) —
  -- no "at least one required" CHECK, since a thread may not be matched to
  -- a contact/lead yet.
  CONSTRAINT email_threads_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES public.contacts(id, tenant_id),
  CONSTRAINT email_threads_lead_fk FOREIGN KEY (lead_id, tenant_id)
    REFERENCES public.leads(id, tenant_id)
);

CREATE INDEX idx_email_threads_tenant_last_message ON public.email_threads(tenant_id, last_message_at DESC);

-- =============================================================================
-- 4. email_messages — individual messages within a thread, in order
-- =============================================================================

CREATE TABLE public.email_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id           uuid NOT NULL,
  direction           email_direction NOT NULL,
  from_address        text NOT NULL,
  to_addresses        text[],
  body_text           text,
  body_html           text,
  sent_at             timestamptz,
  received_at         timestamptz,
  -- Makes "fetch all messages in a thread, in order" trivial — a single
  -- ORDER BY occurred_at, no conditional COALESCE needed in every query.
  -- Nullable: a not-yet-sent ai_draft_pending message has neither sent_at
  -- nor received_at yet.
  occurred_at          timestamptz GENERATED ALWAYS AS (COALESCE(sent_at, received_at)) STORED,
  source_message_id   text,
  authored_by          email_authored_by NOT NULL,
  requires_approval    boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_messages_thread_fk FOREIGN KEY (thread_id, tenant_id)
    REFERENCES public.email_threads(id, tenant_id),
  -- Data-integrity guard only — does not encode ai_quoting_mode business
  -- logic (that stays in ai-email-draft). Just prevents a nonsensical state
  -- like a human-authored or already-sent message being marked pending.
  CONSTRAINT email_messages_approval_requires_ai_draft
    CHECK (requires_approval = false OR authored_by = 'ai_draft_pending')
);

CREATE INDEX idx_email_messages_thread_occurred ON public.email_messages(thread_id, occurred_at);
CREATE INDEX idx_email_messages_tenant_id ON public.email_messages(tenant_id);
-- Not unique yet — the future sync worker decides the right dedup scope
-- (per-mailbox vs per-tenant); this index only makes future lookups fast.
CREATE INDEX idx_email_messages_source_message_id ON public.email_messages(source_message_id) WHERE source_message_id IS NOT NULL;

-- =============================================================================
-- 5. ai_quoting_mode on tenant_settings
-- =============================================================================
-- Default 'off' for every tenant, including all existing ones — Postgres
-- backfills the DEFAULT for existing rows on ADD COLUMN, so no tenant
-- silently starts having AI touch their inbox because a column got added.

ALTER TABLE public.tenant_settings
  ADD COLUMN ai_quoting_mode ai_quoting_mode NOT NULL DEFAULT 'off';

-- =============================================================================
-- 6. Row Level Security
-- =============================================================================
-- Same pattern as quotes/pricing_settings: super_admin_all + tenant-scoped
-- admin_dispatcher_all. No crew/customer policies — inbox tooling is
-- dispatcher/admin-facing, not customer- or crew-facing.

ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- mailboxes
CREATE POLICY super_admin_all ON public.mailboxes FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON public.mailboxes FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- Column-level protection on top of RLS — see comment on the table above.
REVOKE SELECT (encrypted_credential) ON public.mailboxes FROM authenticated;

-- email_threads
CREATE POLICY super_admin_all ON public.email_threads FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON public.email_threads FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- email_messages
CREATE POLICY super_admin_all ON public.email_messages FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON public.email_messages FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

COMMIT;
