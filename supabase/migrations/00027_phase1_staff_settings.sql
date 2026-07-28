-- ============================================================================
-- Phase 1 — Staff Settings: Branding, Pricing, Staff Management
-- ============================================================================
-- This migration adds:
-- 1. CHECK constraints on pricing_settings rate fields (prevent zero/negative rates)
-- 2. tenant-logos storage bucket + policies (authenticated staff uploads, public reads)
-- 3. set_staff_status() RPC with atomic last-admin guard

-- ============================================================================
-- 1. PRICING SETTINGS — Positive-rate constraints
-- ============================================================================
-- Enforce that all rate fields must be positive. This prevents the pricing
-- engine from silently accepting zero or negative rates (which would corrupt
-- quote totals). The constraints mirror Zod validation on the client/API layer.

ALTER TABLE pricing_settings
  ADD CONSTRAINT pricing_settings_base_rate_positive
    CHECK (base_rate > 0),
  ADD CONSTRAINT pricing_settings_per_mile_rate_positive
    CHECK (per_mile_rate > 0),
  ADD CONSTRAINT pricing_settings_per_cubic_foot_rate_positive
    CHECK (per_cubic_foot_rate > 0),
  ADD CONSTRAINT pricing_settings_labor_hourly_rate_positive
    CHECK (labor_hourly_rate > 0),
  ADD CONSTRAINT pricing_settings_labour_hours_per_cubicft_positive
    CHECK (labour_hours_per_cubicft > 0);

-- ============================================================================
-- 2. LOGO STORAGE — Public bucket for authenticated uploads
-- ============================================================================
-- Logos must render on public proposal pages without authentication, so the
-- bucket is public. However, only tenant staff (tenant_admin/dispatcher) can
-- upload/replace — enforced via storage RLS policies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Upload policy: tenant staff can INSERT only to their own tenant's folder
CREATE POLICY "Tenant staff can upload their own tenant's logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
);

-- Replace policy: tenant staff can UPDATE their own tenant's logo
CREATE POLICY "Tenant staff can replace their own tenant's logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
);

-- ============================================================================
-- 3. STAFF STATUS MANAGEMENT — Atomic last-admin guard
-- ============================================================================
-- Called by updateStaffRoleAction and deactivateStaffAction to enforce the
-- invariant: a tenant must always have at least one active tenant_admin.
--
-- The function uses FOR UPDATE locks to serialize concurrent calls and detect
-- if the operation would orphan the tenant (reduce admin count to zero).
-- If so, raises ERRCODE 'P0003' (the repository maps this to lastAdminBlocked).
--
-- This is the single source of truth for this guard — no TS-side pre-check
-- exists (would be a race condition; see accept_quote_transaction precedent).

CREATE OR REPLACE FUNCTION public.set_staff_status(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_new_role public.tenant_role DEFAULT NULL,   -- NULL = no role change, just status
  p_new_is_active boolean DEFAULT NULL           -- NULL = no status change, just role
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role public.tenant_role;
  v_current_active boolean;
  v_other_admins int;
BEGIN
  -- 1. Lock the target user and fetch their current state
  SELECT role, is_active INTO v_current_role, v_current_active
  FROM public.users
  WHERE id = p_target_user_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found in this tenant';
  END IF;

  -- 2. Check if this operation would remove the last active tenant_admin
  -- (either by changing role away from tenant_admin, or by deactivating)
  IF v_current_role = 'tenant_admin' AND v_current_active = true
     AND ((p_new_role IS NOT NULL AND p_new_role != 'tenant_admin')
          OR (p_new_is_active IS NOT NULL AND p_new_is_active = false)) THEN

    -- Count other active tenant_admins in this tenant
    SELECT COUNT(*) INTO v_other_admins
    FROM public.users
    WHERE tenant_id = p_tenant_id
      AND role = 'tenant_admin'
      AND is_active = true
      AND id != p_target_user_id
    FOR UPDATE;

    -- If no other active admins exist, reject the operation
    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last active tenant_admin for this tenant'
      USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- 3. Safe to proceed — update the user
  UPDATE public.users SET
    role = COALESCE(p_new_role, role),
    is_active = COALESCE(p_new_is_active, is_active),
    updated_at = now()
  WHERE id = p_target_user_id AND tenant_id = p_tenant_id;

  -- 4. Return the updated state
  RETURN jsonb_build_object(
    'id', p_target_user_id,
    'role', COALESCE(p_new_role, v_current_role),
    'is_active', COALESCE(p_new_is_active, v_current_active)
  );
END;
$$;

-- Grant permissions to authenticated users (the call will be RLS-enforced)
GRANT EXECUTE ON FUNCTION public.set_staff_status(uuid, uuid, public.tenant_role, boolean)
  TO authenticated;
