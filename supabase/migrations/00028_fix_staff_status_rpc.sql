-- ============================================================================
-- Fix set_staff_status RPC — remove FOR UPDATE from COUNT query
-- ============================================================================
-- The previous version had FOR UPDATE on COUNT(*), which is not allowed in
-- PostgreSQL (aggregate functions cannot use FOR UPDATE). The first FOR UPDATE
-- on the target user row is sufficient for serialization; we only need a plain
-- SELECT on the count query.

CREATE OR REPLACE FUNCTION public.set_staff_status(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_new_role public.tenant_role DEFAULT NULL,
  p_new_is_active boolean DEFAULT NULL
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

    -- Count other active tenant_admins (no FOR UPDATE on aggregate)
    SELECT COUNT(*) INTO v_other_admins
    FROM public.users
    WHERE tenant_id = p_tenant_id
      AND role = 'tenant_admin'
      AND is_active = true
      AND id != p_target_user_id;

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
