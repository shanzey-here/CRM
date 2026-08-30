-- Migration: 20260831131000_fix_default_label_delete_guard
-- Branch: feature/phase4-fix-email-labels-seeding-regression
--
-- Reconciles already-applied environments with section 3 of
-- 20260831130000_fix_email_labels_seeding_regression.sql (which restored
-- email_labels seeding, re-exposing the unconditional
-- prevent_default_label_delete() guard — it blocks the tenant-deletion
-- cascade, including the provisioning rollback in
-- src/modules/tenants/server/provisioning.ts).
--
-- Fix: only block the delete while the parent tenant still exists. A direct
-- `DELETE FROM email_labels WHERE is_default` for a live tenant is still
-- rejected; a tenant-cascade delete (parent row already gone) passes through.
-- On a fresh database this is a no-op CREATE OR REPLACE — the base migration
-- already carries the corrected body.

CREATE OR REPLACE FUNCTION public.prevent_default_label_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_default AND EXISTS (SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id) THEN
    RAISE EXCEPTION 'Cannot delete a default email label';
  END IF;
  RETURN OLD;
END;
$$;
