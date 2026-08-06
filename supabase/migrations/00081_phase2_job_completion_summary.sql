-- =============================================================================
-- Migration: 00081_phase2_job_completion_summary.sql
-- Description: Adds a system-generated completion summary to jobs, compiled
-- once from real, already-tracked data at the moment a job is genuinely
-- completed (real crew sign-off, server-confirmed). Distinct from
-- job_signoffs (legal signature capture) and internal_notes/customer_notes
-- (manual dispatcher free text) — this is an auto-generated, frozen record.
-- A single jsonb column on jobs, not a dedicated table: this is a 1:1,
-- generate-once artifact per job with no need for history/independent
-- querying, so it inherits jobs' own tenant-scoped RLS automatically.
-- =============================================================================

ALTER TABLE jobs ADD COLUMN completion_summary jsonb;
ALTER TABLE jobs ADD COLUMN completion_summary_generated_at timestamptz;
