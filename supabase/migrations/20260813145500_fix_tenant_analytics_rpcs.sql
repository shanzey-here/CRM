-- Migration: Fix tenant analytics RPCs bugs
-- 1. Missing JOIN for confirmed_counts in get_tenant_quotes_bookings_over_time
-- 2. Incorrect enum value 'cancelled' (should be 'void') in get_tenant_revenue_over_time

-- 1. Quotes and Confirmed Bookings over time
CREATE OR REPLACE FUNCTION get_tenant_quotes_bookings_over_time(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  period text,
  bucket_date date,
  quotes_sent int,
  confirmed_bookings int,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval text;
  v_days int;
BEGIN
  v_days := p_end_date - p_start_date;
  IF v_days <= 60 THEN
    v_interval := '1 day';
  ELSE
    v_interval := '1 month';
  END IF;

  RETURN QUERY
  WITH periods AS (
    SELECT
      g.d::date AS b_date,
      CASE 
        WHEN v_interval = '1 day' THEN to_char(g.d, 'Mon DD')
        ELSE to_char(g.d, 'Mon YY')
      END AS period_label,
      g.d AS period_start,
      g.d + v_interval::interval AS period_end
    FROM generate_series(
      CASE WHEN v_interval = '1 month' THEN date_trunc('month', p_start_date::timestamp) ELSE p_start_date::timestamp END, 
      p_end_date::timestamp, 
      v_interval::interval
    ) g(d)
  ),
  sent_counts AS (
    SELECT
      CASE WHEN v_interval = '1 month' THEN date_trunc('month', created_at at time zone 'UTC')::date ELSE (created_at at time zone 'UTC')::date END AS b_date,
      count(*) AS count
    FROM quotes
    WHERE tenant_id = p_tenant_id
      AND status != 'draft'
      AND (created_at at time zone 'UTC')::date >= p_start_date
      AND (created_at at time zone 'UTC')::date <= p_end_date
    GROUP BY 1
  ),
  confirmed_counts AS (
    SELECT
      CASE WHEN v_interval = '1 month' THEN date_trunc('month', accepted_at at time zone 'UTC')::date ELSE (accepted_at at time zone 'UTC')::date END AS b_date,
      count(*) AS count
    FROM quotes
    WHERE tenant_id = p_tenant_id
      AND status = 'accepted'
      AND accepted_at IS NOT NULL
      AND (accepted_at at time zone 'UTC')::date >= p_start_date
      AND (accepted_at at time zone 'UTC')::date <= p_end_date
    GROUP BY 1
  )
  SELECT
    p.period_label AS period,
    p.b_date AS bucket_date,
    COALESCE(s.count, 0)::int AS quotes_sent,
    COALESCE(c.count, 0)::int AS confirmed_bookings,
    CASE 
      WHEN COALESCE(s.count, 0) > 0 THEN (COALESCE(c.count, 0)::numeric / s.count)
      ELSE NULL
    END AS conversion_rate
  FROM periods p
  LEFT JOIN sent_counts s ON p.b_date = s.b_date
  LEFT JOIN confirmed_counts c ON p.b_date = c.b_date
  ORDER BY p.period_start;
END;
$$;

-- 2. Revenue over time
CREATE OR REPLACE FUNCTION get_tenant_revenue_over_time(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  period text,
  bucket_date date,
  invoiced_revenue numeric,
  collected_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval text;
  v_days int;
BEGIN
  v_days := p_end_date - p_start_date;
  IF v_days <= 60 THEN
    v_interval := '1 day';
  ELSE
    v_interval := '1 month';
  END IF;

  RETURN QUERY
  WITH periods AS (
    SELECT
      g.d::date AS b_date,
      CASE 
        WHEN v_interval = '1 day' THEN to_char(g.d, 'Mon DD')
        ELSE to_char(g.d, 'Mon YY')
      END AS period_label,
      g.d AS period_start
    FROM generate_series(
      CASE WHEN v_interval = '1 month' THEN date_trunc('month', p_start_date::timestamp) ELSE p_start_date::timestamp END, 
      p_end_date::timestamp, 
      v_interval::interval
    ) g(d)
  ),
  invoiced AS (
    SELECT
      CASE WHEN v_interval = '1 month' THEN date_trunc('month', COALESCE(issued_at::timestamptz, created_at) at time zone 'UTC')::date ELSE (COALESCE(issued_at::timestamptz, created_at) at time zone 'UTC')::date END AS b_date,
      sum(total) AS amount
    FROM invoices
    WHERE tenant_id = p_tenant_id
      AND status != 'draft'
      AND status != 'void'
      AND (COALESCE(issued_at::timestamptz, created_at) at time zone 'UTC')::date >= p_start_date
      AND (COALESCE(issued_at::timestamptz, created_at) at time zone 'UTC')::date <= p_end_date
    GROUP BY 1
  ),
  collected AS (
    SELECT
      CASE WHEN v_interval = '1 month' THEN date_trunc('month', COALESCE(paid_at, created_at) at time zone 'UTC')::date ELSE (COALESCE(paid_at, created_at) at time zone 'UTC')::date END AS b_date,
      sum(amount) AS amount
    FROM payments
    WHERE tenant_id = p_tenant_id
      AND status = 'succeeded'
      AND (COALESCE(paid_at, created_at) at time zone 'UTC')::date >= p_start_date
      AND (COALESCE(paid_at, created_at) at time zone 'UTC')::date <= p_end_date
    GROUP BY 1
  )
  SELECT
    p.period_label AS period,
    p.b_date AS bucket_date,
    COALESCE(i.amount, 0) AS invoiced_revenue,
    COALESCE(c.amount, 0) AS collected_revenue
  FROM periods p
  LEFT JOIN invoiced i ON p.b_date = i.b_date
  LEFT JOIN collected c ON p.b_date = c.b_date
  ORDER BY p.period_start;
END;
$$;
