-- Migration: 20260816090000_fix_brand_template_provisioning
-- Two real bugs found during verification, both from the same root cause:
-- invoice_templates.brand_id (UNIQUE) replaced tenant_id (UNIQUE) in the
-- prior migration, but only the tenant-provisioning trigger's default-brand
-- path was updated to create a template row. Two consequences:
--
-- 1. provision_tenant_defaults()'s own invoice_templates INSERT still says
--    `ON CONFLICT (tenant_id) DO NOTHING` — that constraint no longer
--    exists, so this errors at runtime. A genuinely new tenant signup was
--    broken and untested until now (every test in this session reused an
--    existing tenant).
-- 2. Any brand created AFTER a tenant's initial provisioning (i.e. every
--    non-default brand) got zero invoice_templates row at all — nothing
--    ever created one for it — so opening its Invoice Template page
--    crashes with PGRST116 ("Cannot coerce the result to a single JSON
--    object") the moment .single() finds no row.
--
-- Fix: one authoritative seeding mechanism — a trigger on brands itself,
-- firing for every brand however it's created (the app's createBrand(),
-- provision_tenant_defaults()'s own brand insert, or any future path,
-- including raw SQL) — replacing the two divergent, now-broken paths.

CREATE OR REPLACE FUNCTION public.provision_brand_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.invoice_templates (tenant_id, brand_id, layout_blocks)
  VALUES (NEW.tenant_id, NEW.id, '[
    {"type": "header", "config": {"showLogo": true, "alignment": "left"}},
    {"type": "line_items_table", "config": {"columns": ["description", "quantity", "unit_price", "amount"]}},
    {"type": "totals_summary", "config": {"showTaxBreakdown": true}},
    {"type": "terms_text", "config": {"show": true}},
    {"type": "footer", "config": {"showPageNumber": true, "customText": null}}
  ]'::jsonb)
  ON CONFLICT (brand_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER provision_brand_defaults_trigger
  AFTER INSERT ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.provision_brand_defaults();

-- provision_tenant_defaults() no longer inserts invoice_templates itself —
-- its own INSERT INTO public.brands (...) above now triggers the same
-- seeding via provision_brand_defaults_trigger, so this was a second,
-- now-redundant (and broken) copy of the same default layout.
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

  RETURN NEW;
END;
$$;

-- Real backfill: any brand that exists today with no invoice_templates row
-- at all (every non-default brand created since the prior migration —
-- confirmed via audit to be a real, reproducible gap, not hypothetical).
INSERT INTO public.invoice_templates (tenant_id, brand_id, layout_blocks)
SELECT b.tenant_id, b.id, '[
    {"type": "header", "config": {"showLogo": true, "alignment": "left"}},
    {"type": "line_items_table", "config": {"columns": ["description", "quantity", "unit_price", "amount"]}},
    {"type": "totals_summary", "config": {"showTaxBreakdown": true}},
    {"type": "terms_text", "config": {"show": true}},
    {"type": "footer", "config": {"showPageNumber": true, "customText": null}}
  ]'::jsonb
FROM public.brands b
LEFT JOIN public.invoice_templates it ON it.brand_id = b.id
WHERE it.id IS NULL;
