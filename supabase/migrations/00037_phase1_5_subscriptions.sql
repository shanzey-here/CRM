-- =============================================================================
-- Migration: 00037_phase1_5_subscriptions.sql
-- Description: Phase 1.5 SaaS Subscription Database Schema
-- =============================================================================

BEGIN;

-- 1. saas_plans Table
CREATE TABLE public.saas_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_product_id text UNIQUE,
    name text NOT NULL,
    description text,
    entitlements jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);

-- 2. saas_prices Table
CREATE TYPE public.saas_pricing_interval AS ENUM ('month', 'year');

CREATE TABLE public.saas_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_price_id text UNIQUE NOT NULL,
    plan_id uuid REFERENCES public.saas_plans(id) ON DELETE CASCADE,
    unit_amount integer,
    currency text DEFAULT 'usd',
    interval public.saas_pricing_interval,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);

-- 3. tenant_subscriptions Table
CREATE TABLE public.tenant_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    stripe_subscription_id text UNIQUE,
    status public.tenant_status NOT NULL DEFAULT 'trialing',
    price_id uuid REFERENCES public.saas_prices(id),
    current_period_end timestamptz,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);

-- Indexes
CREATE INDEX idx_tenant_subscriptions_tenant_id ON public.tenant_subscriptions(tenant_id);
CREATE INDEX idx_saas_prices_plan_id ON public.saas_prices(plan_id);

-- 4. Audit Logging Triggers
-- Ensures both human super-admin manual edits and automated webhooks are audited
CREATE TRIGGER audit_saas_plans_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.saas_plans
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

CREATE TRIGGER audit_saas_prices_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.saas_prices
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

CREATE TRIGGER audit_tenant_subscriptions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

-- 5. Data Backfill
-- Preserve the status and stripe_subscription_id of existing tenants
INSERT INTO public.tenant_subscriptions (tenant_id, status, stripe_subscription_id)
SELECT id, status, stripe_subscription_id 
FROM public.tenants;

-- 6. Safely Drop Old Columns from tenants
ALTER TABLE public.tenants
DROP COLUMN status,
DROP COLUMN stripe_subscription_id;

-- 7. Update handle_new_tenant Trigger (migration 00014)
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

-- 8. Row Level Security (RLS)
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- saas_plans RLS
CREATE POLICY "Anyone can view active plans" 
ON public.saas_plans FOR SELECT 
USING (is_active = true OR public.is_super_admin() = true);

CREATE POLICY "Super admins can manage plans" 
ON public.saas_plans FOR ALL 
USING (public.is_super_admin() = true);

-- saas_prices RLS
CREATE POLICY "Anyone can view active prices" 
ON public.saas_prices FOR SELECT 
USING (is_active = true OR public.is_super_admin() = true);

CREATE POLICY "Super admins can manage prices" 
ON public.saas_prices FOR ALL 
USING (public.is_super_admin() = true);

-- tenant_subscriptions RLS
CREATE POLICY "Tenant users can view their subscription" 
ON public.tenant_subscriptions FOR SELECT 
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Super admins can manage subscriptions" 
ON public.tenant_subscriptions FOR ALL 
USING (public.is_super_admin() = true);

-- Note: Webhooks will use the service_role key, which bypasses RLS automatically.

COMMIT;
