-- =============================================================================
-- Migration: 00077_phase2_add_stage_change_to_activity_type.sql
-- Description: Adds 'stage_change' to activity_type enum which was previously omitted due to duplicate object exception.
-- =============================================================================

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'stage_change';
