-- Migration: 00025_fix_rls_recursion_properly
-- Description: Use SECURITY DEFINER functions to break RLS infinite recursion between leads and contacts.

-- Create a schema to hide these internal functions if needed, or just put them in public.
-- Using public but prefixing with internal_

CREATE OR REPLACE FUNCTION public.internal_get_crew_contact_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contact_id FROM leads WHERE assigned_to = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.internal_get_customer_contact_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM contacts WHERE user_id = p_user_id;
$$;

-- Drop previous buggy policies
DROP POLICY IF EXISTS crew_select ON contacts;
CREATE POLICY crew_select ON contacts FOR SELECT
  USING (
    public.current_user_role() = 'crew'
    AND tenant_id = public.current_tenant_id()
    AND id IN (SELECT public.internal_get_crew_contact_ids(auth.uid()))
  );

DROP POLICY IF EXISTS customer_select ON leads;
CREATE POLICY customer_select ON leads FOR SELECT
  USING (
    public.current_user_role() = 'customer'
    AND tenant_id = public.current_tenant_id()
    AND contact_id IN (SELECT public.internal_get_customer_contact_ids(auth.uid()))
  );
