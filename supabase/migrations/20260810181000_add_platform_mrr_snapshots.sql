-- Daily MRR history, started now so a real trend chart has real data by the
-- time it's worth building — deliberately decoupled from the Analytics
-- page's own UI, which does not attempt to show a trend from zero history.
CREATE TABLE public.platform_mrr_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  -- numeric(12,2): this app's real, general money-column convention
  -- (quotes.total_price, invoices.total, etc. in 00001_phase0_foundations.sql)
  -- — not saas_prices.unit_amount's Stripe-minor-units integer convention,
  -- since this is a derived business metric, not a Stripe mirror.
  mrr numeric(12,2) NOT NULL,
  active_tenant_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_mrr_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view MRR snapshots"
ON public.platform_mrr_snapshots FOR SELECT
USING (public.is_super_admin() = true);

-- No INSERT/UPDATE/DELETE policy for any role — only the cron route
-- (service_role, bypasses RLS) writes to this table.
