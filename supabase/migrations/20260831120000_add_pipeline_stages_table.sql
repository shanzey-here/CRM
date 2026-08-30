-- Migration: 20260831120000_add_pipeline_stages_table
-- Branch: feature/phase4-pipeline-stage-data-model
--
-- Introduces a real, tenant-scoped, dynamic pipeline-stage model to replace
-- the fixed `lead_stage` Postgres enum. This branch adds ONLY the table and
-- its correct seeding:
--
--   * `leads.stage` is NOT migrated off the enum here — that is
--     feature/phase4-pipeline-stage-migration-execute.
--   * `kanbanStageSchema` (src/app/office/leads/actions.ts) is NOT changed
--     here — see the "kanbanStageSchema" note at the bottom of this file.
--   * No "+ Add column" / reorder / rename / delete UI — later branches.
--
-- The 7 existing enum values ALL become real rows for every tenant, including
-- `completed` and `archived`, which stay hidden from the visual board by
-- default (flagged, not omitted) so a future report/filter can address them
-- as real rows.

-- =============================================================================
-- 1. pipeline_stages table
-- =============================================================================
-- `key`  — stable identifier for the 7 built-in stages: exactly the current
--          `lead_stage` enum value ('inquiry', 'survey_scheduled', ...). NULL
--          for tenant-created stages later. This is the single mapping between
--          a stage row and the enum value `leads.stage` still holds today, so
--          the migration-execute branch has one unambiguous join
--          (`leads.stage::text = pipeline_stages.key`) and this never becomes
--          a second, parallel notion of "what stage is a lead in".
--
-- `is_system` vs `is_hidden_by_default` — deliberately TWO independent
--          booleans, not one:
--            - is_system            = built-in, protected from deletion
--                                     (enforced by trigger below).
--            - is_hidden_by_default = not rendered as a board column by
--                                     default.
--          All 7 built-ins are is_system = true. Only `completed`/`archived`
--          are also is_hidden_by_default = true. Keeping them separate means a
--          future custom stage can be deletable-but-off-board, or
--          system-but-on-board, without conflating the two concerns.
--
-- `position` — integer, low = leftmost. Matches the codebase convention for
--          ordering columns (invoice_line_items.sort_order,
--          workflow_steps.sort_order, ... all `integer`). Seeded 1..5 in the
--          exact KANBAN_STAGES order, then 6/7 for the hidden pair. The
--          reorder branch owns any spacing/fractional-index strategy.
--
-- `color` — hex, mirrors the KANBAN_STAGES colour for the 5 active built-ins
--          so "become real rows" doesn't silently drop the per-stage colour
--          the board already uses. NULL for `completed`/`archived` — there is
--          no prior colour for them anywhere (they are not on the board), so
--          the branch that first surfaces them picks one.
--
-- UNIQUE (id, tenant_id) — composite candidate key, same convention as
--          email_labels: lets the migration-execute branch add a composite FK
--          from leads -> pipeline_stages(id, tenant_id) that is
--          tenant-safe at the DB level.

CREATE TABLE public.pipeline_stages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key                   text,
  name                  text NOT NULL,
  color                 text,
  position              integer NOT NULL,
  is_system             boolean NOT NULL DEFAULT false,
  is_hidden_by_default  boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,
  CONSTRAINT pipeline_stages_tenant_id_key UNIQUE (id, tenant_id),
  CONSTRAINT pipeline_stages_color_hex_format CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$')
);

CREATE INDEX idx_pipeline_stages_tenant ON public.pipeline_stages(tenant_id);
-- One stage name per tenant, case-insensitive (mirrors email_labels_tenant_name_unique).
CREATE UNIQUE INDEX pipeline_stages_tenant_name_unique
  ON public.pipeline_stages(tenant_id, lower(name));
-- One row per built-in key per tenant; also makes the backfill / provisioning
-- inserts idempotent on re-run.
CREATE UNIQUE INDEX pipeline_stages_tenant_key_unique
  ON public.pipeline_stages(tenant_id, key) WHERE key IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 2. RLS — identical two-policy shape to email_labels
--    (20260810160000_add_email_labels.sql) and brands
--    (20260814090000_add_brands_and_thread_brand_id.sql): internal pipeline
--    config, admin/dispatcher-facing only, super_admin all. Not a new pattern.
-- =============================================================================
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON public.pipeline_stages FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON public.pipeline_stages FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

-- =============================================================================
-- 3. System stages cannot be deleted — DB-level, not just a hidden button.
--    Same idiom as email_labels' prevent_default_label_delete trigger, with
--    one addition: the guard is skipped when the parent tenant is itself gone.
--    Tenant deletion is a real live code path (the provisioning rollback in
--    src/modules/tenants/server/provisioning.ts) and cascades a DELETE to this
--    table — an unconditional RAISE would break that cascade and leave a
--    half-provisioned tenant. Direct `DELETE FROM pipeline_stages` for a live
--    tenant is still blocked.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_system_stage_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_system AND EXISTS (SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id) THEN
    RAISE EXCEPTION 'Cannot delete a system pipeline stage (%).', OLD.key;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_system_stage_delete_trigger
  BEFORE DELETE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_stage_delete();

-- =============================================================================
-- 4. Backfill: every existing tenant gets all 7 built-in stages.
--    Positions 1..5 match KANBAN_STAGES order exactly; 6/7 place the
--    hidden pair sensibly after the active ones.
--    Bare ON CONFLICT DO NOTHING (covers every unique index) — same as the
--    email_labels backfill; makes this safe to re-run.
-- =============================================================================
INSERT INTO public.pipeline_stages (tenant_id, key, name, color, position, is_system, is_hidden_by_default)
SELECT t.id, d.key, d.name, d.color, d.position, true, d.is_hidden_by_default
FROM public.tenants t
CROSS JOIN (VALUES
  ('inquiry',           'Inquiry',            '#94a3b8'::text, 1, false),
  ('survey_scheduled',  'Survey Scheduled',   '#64748b'::text, 2, false),
  ('quote_sent',        'Quote Sent',         '#3b82f6'::text, 3, false),
  ('follow_up',         'Follow Up',          '#f59e0b'::text, 4, false),
  ('confirmed_booking', 'Confirmed Booking',  '#10b981'::text, 5, false),
  ('completed',         'Completed',          NULL::text,      6, true),
  ('archived',          'Archived',           NULL::text,      7, true)
) AS d(key, name, color, position, is_hidden_by_default)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. provision_tenant_defaults(): seed the same 7 rows for every new tenant.
--
--    CREATE OR REPLACE re-declares the WHOLE function, so the body below is
--    the current live definition (verified against the remote DB:
--    tenant_settings -> pricing_settings -> tenant_subscriptions -> default
--    brand) with the pipeline_stages block appended before RETURN NEW.
--    Nothing else is added or removed.
--
--    NOTE (pre-existing, out of scope for this branch): the live function does
--    NOT seed email_labels — 20260814090000_add_brands_and_thread_brand_id.sql
--    replaced the function and dropped the block that
--    20260810161000_seed_email_labels.sql had added. Tenants created after
--    2026-08-14 have zero email labels. Flagged for the team; NOT fixed here.
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

  RETURN NEW;
END;
$$;
