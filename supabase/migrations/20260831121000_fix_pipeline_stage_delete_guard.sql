-- Migration: 20260831121000_fix_pipeline_stage_delete_guard
-- Branch: feature/phase4-pipeline-stage-data-model
--
-- Reconciles already-applied environments with the corrected
-- prevent_system_stage_delete() in 20260831120000_add_pipeline_stages_table.sql.
--
-- The first version of that trigger raised unconditionally when OLD.is_system.
-- Because every tenant is seeded 7 is_system pipeline_stages at provision time
-- and pipeline_stages.tenant_id is ON DELETE CASCADE, that unconditional RAISE
-- also blocked the tenant-deletion cascade — including the provisioning
-- rollback path (src/modules/tenants/server/provisioning.ts), which would fail
-- silently and leave a half-provisioned tenant.
--
-- Fix: only block the delete while the parent tenant still exists. A direct
-- `DELETE FROM pipeline_stages WHERE is_system` for a live tenant is still
-- rejected; a tenant-cascade delete (parent row already gone) passes through.
-- On a fresh database this is a no-op CREATE OR REPLACE — the base migration
-- already carries the corrected body.

CREATE OR REPLACE FUNCTION public.prevent_system_stage_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_system AND EXISTS (SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id) THEN
    RAISE EXCEPTION 'Cannot delete a system pipeline stage (%).', OLD.key;
  END IF;
  RETURN OLD;
END;
$$;
