-- =============================================================================
-- Migration: 00078_phase2_job_crew_actual_times.sql
-- Description: Adds actual_start/actual_end to job_crew_assignments so a
-- dispatcher can record real crew timing when it differs from the plan
-- (scheduled_start/scheduled_end), without touching the scheduled columns.
-- No RLS changes needed — these are just new columns on an existing,
-- already-tenant-scoped table; existing row-level policies already cover them.
-- =============================================================================

ALTER TABLE job_crew_assignments ADD COLUMN actual_start timestamptz;
ALTER TABLE job_crew_assignments ADD COLUMN actual_end timestamptz;
