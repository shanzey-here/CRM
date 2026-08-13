-- Migration: Add tenant-scoped analytics RPCs (Phase 3)
-- These RPCs provide the data for the high-level metrics dashboard on /office/reports.

-- 1. Quotes and Confirmed Bookings over time
CREATE OR REPLACE FUNCTION get_tenant_quotes_bookings_over_time(
  p_tenant_id uuid,
  p_months int
)
RETURNS TABLE (
  period text,
  year int,
  month int,
  quotes_sent int,
  confirmed_bookings int,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start timestamptz;
BEGIN
  -- We use UTC bounds to prevent local timezone shifts from drifting buckets
  v_window_start := date_trunc('month', (now() at time zone 'UTC') - (p_months - 1 || ' months')::interval) at time zone 'UTC';

  RETURN QUERY
  WITH periods AS (
    SELECT
      to_char(g.d, 'Mon YY') AS period,
      extract(year from g.d)::int AS year,
      extract(month from g.d)::int - 1 AS month, -- 0-indexed for JS compatibility
      g.d AS period_start,
      g.d + interval '1 month' AS period_end
    FROM generate_series(v_window_start, (now() at time zone 'UTC'), '1 month'::interval) g(d)
  ),
  sent_counts AS (
    SELECT
      extract(year from (created_at at time zone 'UTC'))::int AS y,
      extract(month from (created_at at time zone 'UTC'))::int - 1 AS m,
      count(*) AS count
    FROM quotes
    WHERE tenant_id = p_tenant_id
      AND status != 'draft'
      AND created_at >= v_window_start
    GROUP BY 1, 2
  ),
  confirmed_counts AS (
    SELECT
      extract(year from (accepted_at at time zone 'UTC'))::int AS y,
      extract(month from (accepted_at at time zone 'UTC'))::int - 1 AS m,
      count(*) AS count
    FROM quotes
    WHERE tenant_id = p_tenant_id
      AND status = 'accepted'
      AND accepted_at IS NOT NULL
      AND accepted_at >= v_window_start
    GROUP BY 1, 2
  )
  SELECT
    p.period,
    p.year,
    p.month,
    COALESCE(s.count, 0)::int AS quotes_sent,
    COALESCE(c.count, 0)::int AS confirmed_bookings,
    CASE 
      WHEN COALESCE(s.count, 0) > 0 THEN (COALESCE(c.count, 0)::numeric / s.count)
      ELSE NULL
    END AS conversion_rate
  FROM periods p
  LEFT JOIN sent_counts s ON p.year = s.y AND p.month = s.m
  LEFT JOIN confirmed_counts c ON p.year = c.y AND p.month = c.m
  ORDER BY p.period_start;
END;
$$;

-- 2. Invoiced vs Collected Revenue over time
CREATE OR REPLACE FUNCTION get_tenant_revenue_over_time(
  p_tenant_id uuid,
  p_months int
)
RETURNS TABLE (
  period text,
  year int,
  month int,
  invoiced_revenue numeric,
  collected_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start timestamptz;
BEGIN
  v_window_start := date_trunc('month', (now() at time zone 'UTC') - (p_months - 1 || ' months')::interval) at time zone 'UTC';

  RETURN QUERY
  WITH periods AS (
    SELECT
      to_char(g.d, 'Mon YY') AS period,
      extract(year from g.d)::int AS year,
      extract(month from g.d)::int - 1 AS month,
      g.d AS period_start
    FROM generate_series(v_window_start, (now() at time zone 'UTC'), '1 month'::interval) g(d)
  ),
  invoiced AS (
    SELECT
      extract(year from (COALESCE(issued_at::timestamptz, created_at) at time zone 'UTC'))::int AS y,
      extract(month from (COALESCE(issued_at::timestamptz, created_at) at time zone 'UTC'))::int - 1 AS m,
      sum(total) AS amount
    FROM invoices
    WHERE tenant_id = p_tenant_id
      AND status != 'draft'
      AND status != 'cancelled'
      AND COALESCE(issued_at::timestamptz, created_at) >= v_window_start
    GROUP BY 1, 2
  ),
  collected AS (
    SELECT
      extract(year from (COALESCE(paid_at, created_at) at time zone 'UTC'))::int AS y,
      extract(month from (COALESCE(paid_at, created_at) at time zone 'UTC'))::int - 1 AS m,
      sum(amount) AS amount
    FROM payments
    WHERE tenant_id = p_tenant_id
      AND status = 'succeeded'
      AND COALESCE(paid_at, created_at) >= v_window_start
    GROUP BY 1, 2
  )
  SELECT
    p.period,
    p.year,
    p.month,
    COALESCE(i.amount, 0) AS invoiced_revenue,
    COALESCE(c.amount, 0) AS collected_revenue
  FROM periods p
  LEFT JOIN invoiced i ON p.year = i.y AND p.month = i.m
  LEFT JOIN collected c ON p.year = c.y AND p.month = c.m
  ORDER BY p.period_start;
END;
$$;

-- 3. New Clients Acquired over time
CREATE OR REPLACE FUNCTION get_tenant_new_clients_over_time(
  p_tenant_id uuid,
  p_months int
)
RETURNS TABLE (
  period text,
  year int,
  month int,
  new_clients int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start timestamptz;
BEGIN
  v_window_start := date_trunc('month', (now() at time zone 'UTC') - (p_months - 1 || ' months')::interval) at time zone 'UTC';

  RETURN QUERY
  WITH periods AS (
    SELECT
      to_char(g.d, 'Mon YY') AS period,
      extract(year from g.d)::int AS year,
      extract(month from g.d)::int - 1 AS month,
      g.d AS period_start
    FROM generate_series(v_window_start, (now() at time zone 'UTC'), '1 month'::interval) g(d)
  ),
  clients AS (
    SELECT
      extract(year from (created_at at time zone 'UTC'))::int AS y,
      extract(month from (created_at at time zone 'UTC'))::int - 1 AS m,
      count(*) AS count
    FROM contacts
    WHERE tenant_id = p_tenant_id
      AND created_at >= v_window_start
    GROUP BY 1, 2
  )
  SELECT
    p.period,
    p.year,
    p.month,
    COALESCE(c.count, 0)::int AS new_clients
  FROM periods p
  LEFT JOIN clients c ON p.year = c.y AND p.month = c.m
  ORDER BY p.period_start;
END;
$$;
