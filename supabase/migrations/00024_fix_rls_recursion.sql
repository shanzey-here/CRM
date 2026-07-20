-- Migration: 00024_fix_rls_recursion
-- Description: Fix infinite recursion between leads and contacts RLS policies by forcing short-circuit evaluation using CASE statements.

-- 1. Fix contacts policy (crew querying leads)
DROP POLICY IF EXISTS crew_select ON contacts;
CREATE POLICY crew_select ON contacts FOR SELECT
  USING (
    CASE WHEN public.current_user_role() = 'crew' THEN
      tenant_id = public.current_tenant_id()
      AND id IN (
        SELECT contact_id FROM leads
        WHERE assigned_to = auth.uid()
          AND tenant_id = public.current_tenant_id()
      )
    ELSE false END
  );

-- 2. Fix leads policy (customer querying contacts)
DROP POLICY IF EXISTS customer_select ON leads;
CREATE POLICY customer_select ON leads FOR SELECT
  USING (
    CASE WHEN public.current_user_role() = 'customer' THEN
      tenant_id = public.current_tenant_id()
      AND contact_id IN (
        SELECT id FROM contacts
        WHERE user_id = auth.uid()
          AND tenant_id = public.current_tenant_id()
      )
    ELSE false END
  );
