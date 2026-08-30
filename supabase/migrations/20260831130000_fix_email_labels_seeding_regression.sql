-- Migration: 20260831130000_fix_email_labels_seeding_regression
-- Branch: feature/phase4-fix-email-labels-seeding-regression
--
-- REGRESSION FIX. provision_tenant_defaults() stopped seeding email_labels on
-- 2026-08-14.
--
-- History of the function body (verified by diffing every CREATE OR REPLACE of
-- it across supabase/migrations/*):
--   00029  tenant_settings, pricing_settings
--   00040  + tenant_subscriptions
--   00068  + invoice_templates (tenant_id)
--   20260810161000  email_labels ADDED   (this rewrite also dropped
--                   invoice_templates — restored 4 days later)
--   20260814090000  brands ADDED, invoice_templates re-added (brand_id),
--                   email_labels SILENTLY DROPPED  <-- the regression
--   20260816090000  invoice_templates moved out to provision_brand_defaults()
--                   trigger on brands (deliberate); email_labels still absent
--   20260831120000  pipeline_stages ADDED; email_labels still absent
--
-- Live impact (queried before this migration): 2 tenants have zero
-- email_labels (both created 2026-08-27, after the gap opened); 85 have the
-- full 8; 1 has 9 (8 defaults + 1 real custom label, "VIP Customer", created
-- 2026-08-10 — pre-gap). Every other seeding block is present and correct:
--   tenant_settings   - 0 tenants missing
--   pricing_settings  - 0 tenants missing
--   tenant_subscriptions - present in the body (3 very old 2026-07-21 test
--                        tenants lack a row, but that predates this block's
--                        maturity and is not a function defect)
--   invoice_templates - 0 brands missing one (seeded via
--                       provision_brand_defaults_trigger, by design)
--   pipeline_stages   - 0 tenants without exactly 7
--
-- This fix is ADDITIVE: it restores email_labels into the CURRENT body
-- (which includes the brands + pipeline_stages blocks added since the gap
-- opened) — it is NOT a reversion to the 2026-08-10 version.

-- =============================================================================
-- 1. provision_tenant_defaults() — current body verbatim + the restored
--    email_labels block (same 8 labels / hex / is_default=true /
--    ON CONFLICT DO NOTHING as 20260810161000_seed_email_labels.sql).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.provision_tenant_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
BEGIN
  INSERT INTO public.tenant_settings (tenant_id, primary_color, address_country)
  VALUES (NEW.id, '#1a56db', 'GB')
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.pricing_settings (
    tenant_id,
    base_rate,
    per_mile_rate,
    per_cubic_foot_rate,
    labor_hourly_rate,
    labour_hours_per_cubicft
  )
  VALUES (NEW.id, 100, 1, 0.5, 25, 0.1)
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.tenant_subscriptions (tenant_id, status, current_period_end)
  VALUES (NEW.id, 'trialing', now() + interval '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.brands (tenant_id, name, public_widget_key, is_default)
  VALUES (NEW.id, 'Default Brand', NEW.public_widget_key, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_brand_id;

  -- Pipeline stages: the 7 built-ins, matching the existing-tenant backfill
  -- above exactly (same keys, names, colours, positions, flags).
  INSERT INTO public.pipeline_stages (tenant_id, key, name, color, position, is_system, is_hidden_by_default)
  VALUES
    (NEW.id, 'inquiry',           'Inquiry',           '#94a3b8', 1, true, false),
    (NEW.id, 'survey_scheduled',  'Survey Scheduled',  '#64748b', 2, true, false),
    (NEW.id, 'quote_sent',        'Quote Sent',        '#3b82f6', 3, true, false),
    (NEW.id, 'follow_up',         'Follow Up',         '#f59e0b', 4, true, false),
    (NEW.id, 'confirmed_booking', 'Confirmed Booking', '#10b981', 5, true, false),
    (NEW.id, 'completed',         'Completed',         NULL,      6, true, true),
    (NEW.id, 'archived',          'Archived',          NULL,      7, true, true)
  ON CONFLICT DO NOTHING;

  -- Email labels: the 8 built-in defaults. RESTORED here — dropped by
  -- 20260814090000. Same values / flag / conflict idiom as the original
  -- 20260810161000_seed_email_labels.sql.
  INSERT INTO public.email_labels (tenant_id, name, color_hex, is_default)
  VALUES
    (NEW.id, 'New Lead', '#3B82F6', true),
    (NEW.id, 'Quote Requested', '#8B5CF6', true),
    (NEW.id, 'Awaiting Reply', '#F59E0B', true),
    (NEW.id, 'Booking Confirmed', '#14B8A6', true),
    (NEW.id, 'Payment Pending', '#F97316', true),
    (NEW.id, 'Paid', '#22C55E', true),
    (NEW.id, 'Job Completed', '#EC4899', true),
    (NEW.id, 'Complaint / Urgent', '#DC2626', true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Backfill: every tenant that currently has ZERO email_labels gets the 8
--    defaults. Condition is a real "count = 0" check (NOT EXISTS), not a date
--    cutoff — so it hits exactly the tenants actually affected and skips every
--    tenant that already has labels (including the one with a custom label).
--    ON CONFLICT DO NOTHING keeps it safe to re-run.
-- =============================================================================
INSERT INTO public.email_labels (tenant_id, name, color_hex, is_default)
SELECT t.id, d.name, d.color_hex, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('New Lead', '#3B82F6'),
  ('Quote Requested', '#8B5CF6'),
  ('Awaiting Reply', '#F59E0B'),
  ('Booking Confirmed', '#14B8A6'),
  ('Payment Pending', '#F97316'),
  ('Paid', '#22C55E'),
  ('Job Completed', '#EC4899'),
  ('Complaint / Urgent', '#DC2626')
) AS d(name, color_hex)
WHERE NOT EXISTS (SELECT 1 FROM public.email_labels e WHERE e.tenant_id = t.id)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. Make prevent_default_label_delete() cascade-safe.
--
--    Restoring email_labels seeding (section 1) means every newly provisioned
--    tenant again has 8 is_default labels. prevent_default_label_delete()
--    (20260810160000_add_email_labels.sql) raises unconditionally on
--    OLD.is_default — so it ALSO blocks the ON DELETE CASCADE from a
--    `DELETE FROM tenants`, including the provisioning rollback in
--    src/modules/tenants/server/provisioning.ts. That rollback would fail
--    silently and leave a half-provisioned tenant. (Same latent bug, and same
--    fix, as prevent_system_stage_delete() in
--    20260831121000_fix_pipeline_stage_delete_guard.sql.)
--
--    Fix: only block the delete while the parent tenant still exists. A direct
--    `DELETE FROM email_labels WHERE is_default` for a live tenant is still
--    rejected; a tenant-cascade delete passes through.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_default_label_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_default AND EXISTS (SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id) THEN
    RAISE EXCEPTION 'Cannot delete a default email label';
  END IF;
  RETURN OLD;
END;
$$;
