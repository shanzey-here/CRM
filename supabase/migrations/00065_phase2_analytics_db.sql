-- Feature: Analytics DB (LTV, Repeat Customers, Funnel)
-- This migration creates live aggregation functions for business performance reporting.
-- It strictly requires the 'analytics' module entitlement.

-- 1. get_contact_ltv
CREATE OR REPLACE FUNCTION get_contact_ltv(p_tenant_id uuid, p_contact_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ltv numeric;
BEGIN
  -- Entitlement check
  IF NOT EXISTS (
    SELECT 1 FROM tenant_modules
    WHERE tenant_id = p_tenant_id
      AND module_key = 'analytics'
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'Tenant lacks analytics entitlement';
  END IF;

  -- Compute LTV: sum of 'succeeded' payments linked to this contact's invoices
  -- Explicitly scoping tenant_id on ALL joined tables for strict isolation.
  SELECT COALESCE(SUM(p.amount), 0) INTO v_ltv
  FROM payments p
  JOIN invoices i ON p.invoice_id = i.id
    AND i.tenant_id = p_tenant_id
  JOIN contacts c ON i.contact_id = c.id
    AND c.tenant_id = p_tenant_id
  WHERE p.tenant_id = p_tenant_id
    AND c.id = p_contact_id
    AND p.status = 'succeeded';

  RETURN v_ltv;
END;
$$;


-- 2. get_repeat_customers
CREATE OR REPLACE FUNCTION get_repeat_customers(p_tenant_id uuid)
RETURNS TABLE (
  contact_id uuid,
  completed_jobs_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Entitlement check
  IF NOT EXISTS (
    SELECT 1 FROM tenant_modules
    WHERE tenant_id = p_tenant_id
      AND module_key = 'analytics'
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'Tenant lacks analytics entitlement';
  END IF;

  RETURN QUERY
  SELECT c.id AS contact_id, COUNT(j.id) AS completed_jobs_count
  FROM contacts c
  JOIN jobs j ON c.id = j.contact_id
    AND j.tenant_id = p_tenant_id
  WHERE c.tenant_id = p_tenant_id
    AND j.status = 'completed'
  GROUP BY c.id
  HAVING COUNT(j.id) >= 2;
END;
$$;


-- 3. get_conversion_funnel
-- Cohort tracking based on lead created_at date.
CREATE OR REPLACE FUNCTION get_conversion_funnel(p_tenant_id uuid, p_start_date date, p_end_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_leads bigint;
  v_quoted_leads bigint;
  v_accepted_leads bigint;
  v_sources json;
BEGIN
  -- Entitlement check
  IF NOT EXISTS (
    SELECT 1 FROM tenant_modules
    WHERE tenant_id = p_tenant_id
      AND module_key = 'analytics'
      AND enabled = true
  ) THEN
    RAISE EXCEPTION 'Tenant lacks analytics entitlement';
  END IF;

  -- 1. Total Leads in cohort
  SELECT COUNT(*) INTO v_total_leads
  FROM leads
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_start_date::timestamp
    AND created_at < (p_end_date + interval '1 day')::timestamp;

  -- 2. Quoted Leads in cohort
  SELECT COUNT(DISTINCT l.id) INTO v_quoted_leads
  FROM leads l
  JOIN quotes q ON q.lead_id = l.id
    AND q.tenant_id = p_tenant_id
  WHERE l.tenant_id = p_tenant_id
    AND l.created_at >= p_start_date::timestamp
    AND l.created_at < (p_end_date + interval '1 day')::timestamp;

  -- 3. Accepted Leads in cohort
  SELECT COUNT(DISTINCT l.id) INTO v_accepted_leads
  FROM leads l
  JOIN quotes q ON q.lead_id = l.id
    AND q.tenant_id = p_tenant_id
  WHERE l.tenant_id = p_tenant_id
    AND l.created_at >= p_start_date::timestamp
    AND l.created_at < (p_end_date + interval '1 day')::timestamp
    AND q.status = 'accepted';

  -- 4. Sources breakdown for cohort
  SELECT json_object_agg(COALESCE(source, 'Unknown'), source_count) INTO v_sources
  FROM (
    SELECT source, COUNT(*) as source_count
    FROM leads
    WHERE tenant_id = p_tenant_id
      AND created_at >= p_start_date::timestamp
      AND created_at < (p_end_date + interval '1 day')::timestamp
    GROUP BY source
  ) s;

  RETURN json_build_object(
    'total_leads', v_total_leads,
    'quoted_leads', v_quoted_leads,
    'accepted_leads', v_accepted_leads,
    'sources', COALESCE(v_sources, '{}'::json)
  );
END;
$$;
