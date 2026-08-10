CREATE OR REPLACE FUNCTION get_crate_stats(p_tenant_id uuid)
RETURNS TABLE (
  total_crates bigint,
  available_crates bigint,
  in_use_crates bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint AS total_crates,
    COUNT(*) FILTER (WHERE status IN ('in_warehouse', 'returned'))::bigint AS available_crates,
    COUNT(*) FILTER (WHERE status = 'with_customer')::bigint AS in_use_crates
  FROM crates
  WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
