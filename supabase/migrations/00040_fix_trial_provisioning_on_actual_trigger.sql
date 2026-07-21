-- =============================================================================
-- Migration: 00040_fix_trial_provisioning_on_actual_trigger.sql
-- Description: Add trial tenant_subscriptions provisioning to the trigger
--              that actually runs on tenant creation
-- =============================================================================
-- Root cause (found while verifying the super-admin createTenant fix with a
-- real insert, not just a compile check): migration 00037's comment claims to
-- "Update handle_new_tenant Trigger (migration 00014)", but no migration in
-- this repo — 00014 or otherwise — ever creates a trigger that calls
-- handle_new_tenant(). Confirmed via grep across supabase/migrations/*.sql
-- and src/: that function is called by nothing. It has been dead code since
-- it was written; 00039's fix to its body was consequently a no-op.
--
-- The trigger that ACTUALLY fires AFTER INSERT ON tenants is
-- provision_tenant_defaults_trigger (migration 00029), calling
-- provision_tenant_defaults() — which predates the subscription schema and
-- only provisions tenant_settings + pricing_settings. This is why creating a
-- tenant produced those two rows but never a tenant_subscriptions row.
--
-- Fix: extend the trigger function that is actually live, rather than wire
-- up the orphaned one — avoids two overlapping AFTER INSERT triggers on the
-- same table both trying to provision settings rows.

BEGIN;

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

  RETURN NEW;
END;
$$;

COMMIT;
