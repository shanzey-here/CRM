-- =============================================================================
-- Migration: 00036_fix_auth_hook_final.sql
-- Description: Fixes the Custom Access Token Hook to correctly read the user ID
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
  v_user_id text;
BEGIN
  -- 1. Safely extract the user ID from the event payload
  v_user_id := COALESCE(
    event->'user'->>'id',
    event->'claims'->>'sub',
    event->>'user_id'
  );

  IF v_user_id IS NULL THEN
    RETURN event; -- Fail gracefully if user ID cannot be found
  END IF;

  -- 2. Fetch current role and tenant_id from public.users
  SELECT role, tenant_id INTO v_role, v_tenant_id
  FROM public.users
  WHERE id = v_user_id::uuid;

  claims := event->'claims';

  -- Ensure app_metadata exists
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  END IF;

  -- 3. Inject tenant_role
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, tenant_role}', to_jsonb(v_role));
  END IF;

  -- 4. Inject tenant_id
  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, tenant_id}', to_jsonb(v_tenant_id));
  END IF;

  -- 5. Re-assign claims back to event
  event := jsonb_set(event, '{claims}', claims);
  
  RETURN event;
EXCEPTION WHEN OTHERS THEN
  -- If anything crashes, return the original event so login doesn't break
  RETURN event;
END;
$$;
