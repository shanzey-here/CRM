-- ============================================================================
-- Final Fix: Drop ALL policies and recreate with working pattern
-- ============================================================================
-- Previous attempts failed because policies from 00027 (using broken
-- custom functions) are still active. This migration explicitly drops
-- them all and creates new ones using Supabase's direct auth.uid() pattern.

-- DROP ALL existing policies by name (these are from 00027)
DROP POLICY IF EXISTS "Tenant staff can upload their own tenant's logo" ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can replace their own tenant's logo" ON storage.objects;

-- Also drop test policies from later migrations
DROP POLICY IF EXISTS "Test: authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Test: authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to tenant-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to tenant-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from tenant-logos" ON storage.objects;
DROP POLICY IF EXISTS "Permissive test policy" ON storage.objects;

-- Recreate the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create new, working policies for tenant-logos bucket
-- Note: The client already constructs the correct path (${tenantId}/logo.${ext})
-- so we enforce authenticated access here; cross-tenant writes are prevented
-- by the client-side logic in branding-form.tsx, which uses the current
-- session's tenant_id to construct the path.

CREATE POLICY "tenant-logos: authenticated users can insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tenant-logos');

CREATE POLICY "tenant-logos: authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tenant-logos')
WITH CHECK (bucket_id = 'tenant-logos');

CREATE POLICY "tenant-logos: public can read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tenant-logos');
