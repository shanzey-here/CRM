-- =============================================================================
-- Migration: 00054_phase2_ai_email_draft.sql
-- Description: ai-email-draft — diagnostic metadata for AI-authored messages.
-- =============================================================================
-- Nullable — only rows with authored_by IN ('ai_draft_pending', 'ai_sent')
-- ever populate this. Stores { model, promptVersion, needsQuote, holdingReply,
-- knownGap } — diagnostic (which model/prompt produced a draft, whether the
-- auto_send known-gap path fired), not integrity-bearing, so no CHECK
-- constraint is added.

BEGIN;

ALTER TABLE public.email_messages ADD COLUMN ai_metadata jsonb;

COMMIT;
