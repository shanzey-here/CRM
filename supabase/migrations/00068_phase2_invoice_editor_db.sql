-- Invoice layout template: per-tenant presentation config for how the real,
-- already-proven invoicing data (invoices/invoice_line_items/payments) gets
-- arranged when rendered. This table is additive only — no changes to any
-- financial table. layout_blocks is a JSONB array of {type, config} objects;
-- every block type's config is a closed, named shape with no field capable
-- of holding an amount/quantity/total (enforced in the zod layer at
-- src/modules/settings/invoice-template/schemas.ts) — real figures are
-- always fetched live via the invoice's own id at render time, never
-- embedded here.

CREATE TABLE invoice_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  layout_blocks jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoice_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON invoice_templates FOR ALL
  USING (public.is_super_admin() = true) WITH CHECK (public.is_super_admin() = true);

-- Internal config, not customer-facing — mirrors pricing_settings exactly,
-- not invoices' customer_select policy.
CREATE POLICY admin_dispatcher_all ON invoice_templates FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

-- Extend the real, live tenant-provisioning trigger (confirmed via audit to
-- be provision_tenant_defaults(), fired by provision_tenant_defaults_trigger
-- from migration 00029 — NOT the dead handle_new_tenant()) so every new
-- tenant gets a sensible default layout immediately, same as
-- tenant_settings/pricing_settings.
CREATE OR REPLACE FUNCTION public.provision_tenant_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default tenant_settings
  INSERT INTO public.tenant_settings (tenant_id, primary_color, address_country)
  VALUES (NEW.id, '#1a56db', 'GB')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Insert default pricing_settings with minimum positive rates
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

  -- Auto-provision 14-day trial subscription
  INSERT INTO public.tenant_subscriptions (tenant_id, status, current_period_end)
  VALUES (NEW.id, 'trialing', now() + interval '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Insert default invoice_templates layout
  INSERT INTO public.invoice_templates (tenant_id, layout_blocks)
  VALUES (NEW.id, '[
    {"type": "header", "config": {"showLogo": true, "alignment": "left"}},
    {"type": "line_items_table", "config": {"columns": ["description", "quantity", "unit_price", "amount"]}},
    {"type": "totals_summary", "config": {"showTaxBreakdown": true}},
    {"type": "terms_text", "config": {"show": true}},
    {"type": "footer", "config": {"showPageNumber": true, "customText": null}}
  ]'::jsonb)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: every tenant that already exists gets the same default row —
-- closes the exact gap a past version of this trigger left for
-- tenant_subscriptions (per 00040's own history/commentary).
INSERT INTO invoice_templates (tenant_id, layout_blocks)
SELECT id, '[
  {"type": "header", "config": {"showLogo": true, "alignment": "left"}},
  {"type": "line_items_table", "config": {"columns": ["description", "quantity", "unit_price", "amount"]}},
  {"type": "totals_summary", "config": {"showTaxBreakdown": true}},
  {"type": "terms_text", "config": {"show": true}},
  {"type": "footer", "config": {"showPageNumber": true, "customText": null}}
]'::jsonb
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
