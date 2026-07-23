-- =============================================================================
-- Migration: 00048_phase2_email_imap_sync.sql
-- Description: Sync-worker support — threading, dedup, failure surfacing, overlap guard
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. email_threads.provider_thread_id
-- =============================================================================
-- Gmail returns its own native threadId per message — Gmail has already
-- solved threading server-side, so we use it directly rather than
-- re-deriving from headers. Generic IMAP has no equivalent; those threads
-- are resolved via In-Reply-To/References matching at sync time (application
-- logic, no schema support needed for that path beyond what already exists).

ALTER TABLE public.email_threads
  ADD COLUMN provider_thread_id text;

CREATE INDEX idx_email_threads_provider_thread_id ON public.email_threads(mailbox_id, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;

-- =============================================================================
-- 2. email_messages.mailbox_id + dedup constraint
-- =============================================================================
-- UNIQUE(tenant_id, mailbox_id, source_message_id) requires mailbox_id to be
-- a real column on this table — Postgres UNIQUE constraints can't reach
-- through the thread_id -> email_threads.mailbox_id join at insert time.
-- Denormalized here, composite-FK'd the same way every other tenant-scoped
-- reference in this schema is.
--
-- Per-mailbox scope (not per-tenant) is deliberate: the same RFC822
-- Message-ID could legitimately land in two different mailboxes for the same
-- tenant (e.g. a CC'd connected address) — those are two genuine received
-- copies, not duplicates of each other.
--
-- Standard SQL UNIQUE semantics treat NULL <> NULL, so this does not block
-- multiple ai_draft_pending rows (source_message_id is NULL until a message
-- is actually sent/received) — no partial index needed.

ALTER TABLE public.email_messages
  ADD COLUMN mailbox_id uuid;

ALTER TABLE public.email_messages
  ADD CONSTRAINT email_messages_mailbox_fk FOREIGN KEY (mailbox_id, tenant_id)
    REFERENCES public.mailboxes(id, tenant_id);

ALTER TABLE public.email_messages
  ADD CONSTRAINT email_messages_dedup UNIQUE (tenant_id, mailbox_id, source_message_id);

-- =============================================================================
-- 3. mailboxes.last_sync_error
-- =============================================================================
-- Surfaced to the tenant's Settings UI alongside is_active=false — a human-
-- readable reason (e.g. "Gmail access was revoked — please reconnect"), not
-- a raw exception. Cleared (set NULL) on the next successful sync.

ALTER TABLE public.mailboxes
  ADD COLUMN last_sync_error text;

-- =============================================================================
-- 4. mailbox_sync_lock — overlap guard for the cron-triggered sync worker
-- =============================================================================
-- Single-row table. The sync route atomically claims it via
-- UPDATE ... WHERE is_running = false OR started_at < now() - stale-threshold
-- RETURNING * — a race-safe pattern under Postgres MVCC regardless of
-- connection pooling, unlike a session-scoped pg_try_advisory_lock, which
-- isn't reliable here: this route runs through Supabase's pooled PostgREST/
-- RPC layer, not a persistent DB session this code controls end to end.
-- The staleness fallback (15 minutes, 3x the 5-minute sync interval) means a
-- crashed run that never reaches its own cleanup doesn't wedge future runs
-- forever.

CREATE TABLE public.mailbox_sync_lock (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),
  is_running  boolean NOT NULL DEFAULT false,
  started_at  timestamptz
);

INSERT INTO public.mailbox_sync_lock (id, is_running) VALUES (true, false);

ALTER TABLE public.mailbox_sync_lock ENABLE ROW LEVEL SECURITY;
-- service_role only — this is worker-internal bookkeeping, no tenant context.
-- No policy for authenticated/anon at all (default-deny), matching the
-- REVOKE-based approach used for stripe_events in the subscriptions branch.
REVOKE ALL ON public.mailbox_sync_lock FROM authenticated, anon;

COMMIT;
