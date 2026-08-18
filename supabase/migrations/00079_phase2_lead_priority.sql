-- =============================================================================
-- Migration: 00079_phase2_lead_priority.sql
-- Description: Adds a lightweight triage field to leads for dispatcher use on
-- the Kanban board/detail page. Reuses the existing priority_level enum
-- (already used by tasks.priority) rather than defining a new type.
-- Deliberately NOT a monetary "estimated value" field — that would risk
-- drifting from or being confused with the real, snapshotted quote price
-- once one exists for this lead.
-- =============================================================================

ALTER TABLE leads ADD COLUMN priority priority_level NOT NULL DEFAULT 'medium';
