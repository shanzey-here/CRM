-- ============================================================================
-- Automatic Tenant Settings Provisioning
-- ============================================================================
-- When a new tenant is created, automatically provision default
-- tenant_settings and pricing_settings rows.
-- This ensures every tenant has sensible defaults immediately.

-- Create trigger function to auto-provision settings on tenant creation
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
  -- These are just starting defaults; tenants will customize them
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

  RETURN NEW;
END;
$$;

-- Attach trigger to tenants table
DROP TRIGGER IF EXISTS provision_tenant_defaults_trigger ON public.tenants;
CREATE TRIGGER provision_tenant_defaults_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_tenant_defaults();

-- Backfill defaults for existing tenants that don't have settings
INSERT INTO public.tenant_settings (tenant_id, primary_color, address_country)
SELECT id, '#1a56db', 'GB'
FROM public.tenants
WHERE id NOT IN (SELECT tenant_id FROM public.tenant_settings)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.pricing_settings (
  tenant_id,
  base_rate,
  per_mile_rate,
  per_cubic_foot_rate,
  labor_hourly_rate,
  labour_hours_per_cubicft
)
SELECT id, 100, 1, 0.5, 25, 0.1
FROM public.tenants
WHERE id NOT IN (SELECT tenant_id FROM public.pricing_settings)
ON CONFLICT (tenant_id) DO NOTHING;
