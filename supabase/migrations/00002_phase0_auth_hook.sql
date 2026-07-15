-- =============================================================================
-- Phase 0 — Custom Access Token Hook
-- =============================================================================
-- This migration creates the Supabase Custom Access Token hook function.
-- It reads the user's `tenant_id` and `role` from the `public.users` table
-- and injects them into the JWT `app_metadata` on sign-in or token refresh.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  v_role public.tenant_role;
  v_tenant_id uuid;
BEGIN
  -- 1. Fetch current role and tenant_id from public.users
  SELECT role, tenant_id INTO v_role, v_tenant_id
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- 2. Inject or remove tenant_role
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, tenant_role}', to_jsonb(v_role));
  ELSE
    claims := claims #- '{app_metadata, tenant_role}';
  END IF;

  -- 3. Inject or remove tenant_id
  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, tenant_id}', to_jsonb(v_tenant_id));
  ELSE
    claims := claims #- '{app_metadata, tenant_id}';
  END IF;

  -- 4. Re-assign claims back to event
  event := jsonb_set(event, '{claims}', claims);
  
  RETURN event;
END;
$$;

-- Grant permissions so the Supabase Auth system can execute the hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
-- Grant access to public.users so the hook can read it
GRANT SELECT ON TABLE public.users TO supabase_auth_admin;
