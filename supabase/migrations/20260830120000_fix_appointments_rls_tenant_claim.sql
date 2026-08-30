-- Fix: the appointments RLS policies (20260811225000_add_appointments.sql) all
-- filter on `(SELECT auth.jwt()->>'tenant_id')::uuid` — a TOP-LEVEL JWT claim
-- that this app's auth hook never sets. `custom_access_token_hook`
-- (00036_fix_auth_hook_final.sql) injects tenant_id under `app_metadata`
-- (`{app_metadata, tenant_id}`), and every other tenant-scoped table in this
-- schema gates RLS with `tenant_id = public.current_tenant_id()` — the shared
-- SECURITY DEFINER helper (00001_phase0_foundations.sql) that reads
-- `... -> 'app_metadata' ->> 'tenant_id'` and is documented as the only
-- reliable resolution path (see 00064_phase2_fleet_db.sql).
--
-- Effect of the bug: for every real authenticated user the predicate compared
-- `tenant_id = NULL`, so SELECT returned zero rows with no error. Survey
-- appointments were created and conflict-checked correctly but never rendered
-- on the Unified Calendar / List view (which read via the user-scoped client).
--
-- This replaces all four policies with the canonical convention. It is a pure
-- policy-expression change — no data migration needed: existing appointment
-- rows become visible to their tenant's staff immediately once the corrected
-- SELECT policy is in place.

DROP POLICY IF EXISTS "Tenant users can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant users can insert their appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant users can update their appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant users can delete their appointments" ON appointments;

CREATE POLICY "Tenant users can view their appointments"
ON appointments FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant users can insert their appointments"
ON appointments FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant users can update their appointments"
ON appointments FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant users can delete their appointments"
ON appointments FOR DELETE
USING (tenant_id = public.current_tenant_id());
