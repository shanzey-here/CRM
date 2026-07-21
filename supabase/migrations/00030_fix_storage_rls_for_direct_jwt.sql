-- ============================================================================
-- Fix Storage RLS Policies to Use Direct JWT Claims
-- ============================================================================
-- The previous policies used custom SECURITY DEFINER functions
-- (current_tenant_id(), current_user_role()) that depend on
-- request.jwt.claims, a PostgREST-specific setting.
--
-- Supabase Storage API does NOT populate request.jwt.claims,
-- so those functions return null during storage operations,
-- causing all upload attempts to fail with RLS rejection.
--
-- Fix: Rewrite policies to use auth.jwt() directly, which the
-- Storage API supports natively.

-- Drop old policies that rely on custom functions
DROP POLICY IF EXISTS "Tenant staff can upload their own tenant's logo" ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can replace their own tenant's logo" ON storage.objects;

-- Create new policies using direct auth.jwt() claims
CREATE POLICY "Tenant staff can upload their own tenant's logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = auth.jwt() -> 'app_metadata' ->> 'tenant_id'
  AND (auth.jwt() -> 'app_metadata' ->> 'tenant_role') IN ('tenant_admin', 'dispatcher')
);

CREATE POLICY "Tenant staff can replace their own tenant's logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = auth.jwt() -> 'app_metadata' ->> 'tenant_id'
  AND (auth.jwt() -> 'app_metadata' ->> 'tenant_role') IN ('tenant_admin', 'dispatcher')
);
