-- =============================================================================
-- Migration: 00039_fix_handle_new_tenant_trial_provisioning.sql
-- Description: Re-apply handle_new_tenant() trial-subscription provisioning
-- =============================================================================
-- Discovered while testing the super-admin createTenant fix: the live
-- handle_new_tenant() function only provisioned tenant_settings and
-- pricing_settings — it was NOT actually running the tenant_subscriptions
-- insert that migration 00037's file specifies, despite 00037 showing as
-- applied (its table/RLS/backfill changes are genuinely live; only this
-- function definition drifted). Verified directly: creating a test tenant
-- produced tenant_settings + pricing_settings rows but zero tenant_subscriptions
-- rows. This re-applies the correct 3-insert version so it matches 00037's
-- intent exactly. CREATE OR REPLACE is idempotent — safe if the live version
-- already matched.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auto-provision Settings
  INSERT INTO public.tenant_settings (tenant_id) VALUES (NEW.id);
  INSERT INTO public.pricing_settings (tenant_id) VALUES (NEW.id);

  -- Auto-provision 14-day trial subscription
  INSERT INTO public.tenant_subscriptions (tenant_id, status, current_period_end)
  VALUES (NEW.id, 'trialing', now() + interval '14 days');

  RETURN NEW;
END;
$$;

COMMIT;
