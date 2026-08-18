-- Platform Health / Churn tab: audit.logs is real and already captures every
-- tenant_subscriptions status transition (confirmed via direct query: 295
-- real rows, real active<->past_due<->active cycles, real trialing->active
-- conversions). But audit.logs' schema is NOT exposed via PostgREST ("Only
-- the following schemas are exposed: public, graphql_public"), so it can't
-- be queried directly from app code.
--
-- This RPC is deliberately narrow: audit.logs holds full before/after row
-- diffs across the whole application (a far more sensitive dataset than
-- just status history — it has plan/price changes, manually_suspended
-- flips, tenant/user PII edits, etc.). This function returns ONLY the
-- status/tenant_id/timestamp fields the churn/retention feature actually
-- needs, filtered to tenant_subscriptions, never a general "give me
-- audit.logs rows" wrapper a future caller could misuse for unrelated data.
CREATE OR REPLACE FUNCTION public.get_tenant_status_transitions()
RETURNS TABLE (
  tenant_id  uuid,
  old_status text,
  new_status text,
  changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gated inside the function body, not just by which page happens to call
  -- it — is_super_admin() reads the calling session's own JWT claim, so
  -- this holds even if some other future caller reuses this RPC.
  IF public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only super admins may call get_tenant_status_transitions()';
  END IF;

  RETURN QUERY
  SELECT
    (COALESCE(l.new_data, l.old_data)->>'tenant_id')::uuid AS tenant_id,
    l.old_data->>'status' AS old_status,
    l.new_data->>'status' AS new_status,
    l.created_at AS changed_at
  FROM audit.logs l
  WHERE l.table_name = 'tenant_subscriptions'
    AND (
      l.action = 'INSERT'
      OR (l.action = 'UPDATE' AND l.old_data->>'status' IS DISTINCT FROM l.new_data->>'status')
    )
  ORDER BY changed_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_status_transitions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_status_transitions TO authenticated;
