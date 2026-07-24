-- =============================================================================
-- Migration: 00055_phase2_ai_review_queue.sql
-- Description: ai-review-queue — atomic claim column closing a double-send
--   race in approveAiDraftAction (concurrent approve calls for the same
--   pending draft could both pass its JS-level authored_by check and both
--   call sendMessage() for real). Nullable; only ever set for the brief
--   window a draft is actively being approved, or permanently if a send
--   succeeded but the follow-up record update failed (see actions.ts).
-- =============================================================================

BEGIN;

ALTER TABLE public.email_messages ADD COLUMN claimed_at timestamptz;

COMMIT;
