-- =============================================================================
-- Migration: 00056_phase2_ai_auto_send_gate.sql
-- Description: email-auto-send — durable resolution log for the auto_send
--   trust-graduation gate. discardAiDraftAction hard-deletes its
--   email_messages row, so the "approved without edits" / "discarded"
--   signal the graduation metric needs can't be recovered from that table
--   after the fact. This small, independent table is written to
--   additively by approveAiDraftAction/discardAiDraftAction at the exact
--   point each already knows the outcome — no change to either function's
--   existing behavior, return values, or callers.
-- =============================================================================

BEGIN;

CREATE TYPE ai_draft_resolution_outcome AS ENUM ('approved_unedited', 'approved_edited', 'discarded');

CREATE TABLE public.ai_draft_resolutions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mailbox_id   uuid,
  thread_id    uuid,
  message_id   uuid,  -- not a hard FK: the email_messages row may already be gone (discard)
  outcome      ai_draft_resolution_outcome NOT NULL,
  resolved_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_draft_resolutions_tenant_resolved_at ON public.ai_draft_resolutions(tenant_id, resolved_at DESC);

ALTER TABLE public.ai_draft_resolutions ENABLE ROW LEVEL SECURITY;

-- Same tenant_admin/dispatcher-scoped pattern as every other operational
-- table in this project (e.g. email_messages, email_threads).
CREATE POLICY "admin_dispatcher_all" ON public.ai_draft_resolutions
  FOR ALL USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

CREATE POLICY "super_admin_all" ON public.ai_draft_resolutions
  FOR ALL USING (public.is_super_admin());

COMMIT;
