-- Root-cause fix for: platform_announcements_created_by_fkey violations (and
-- any other FK into public.users) on real accounts that have an auth.users
-- row but no matching public.users row.
--
-- Confirmed via a real query against this project: several accounts,
-- including a real is_super_admin=true account, have no public.users row.
-- Root cause: there is NO trigger on auth.users anywhere in this project's
-- migrations, so public.users rows are entirely dependent on application
-- code remembering to create them. Two real gaps found:
--   1. supabase/functions/handle-auth-claims/index.ts's `set_super_admin`
--      action does `.from('users').update(...)` — an UPDATE, not an upsert —
--      so it silently does nothing if the row doesn't exist yet.
--   2. No app code path calls `set_super_admin` at all (grep confirms zero
--      references in src/), meaning real super-admin accounts in this
--      project were provisioned entirely outside the app's own code (e.g.
--      directly via the Supabase Dashboard or the raw Admin API), which
--      never touches public.users.
--
-- Fix: a database-level trigger is the only layer that can guarantee this
-- invariant regardless of which path created the auth.users row. It creates
-- a minimal row immediately; application code that later has fuller details
-- (full_name, tenant_id, role) upserts over it — see the companion changes
-- to src/modules/tenants/server/provisioning.ts (insert -> upsert) and
-- handle-auth-claims (update -> upsert), which would otherwise primary-key
-- conflict against the row this trigger creates first.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, tenant_id, role, full_name, email, is_active)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_app_meta_data->>'tenant_id', '')::uuid,
    NULLIF(NEW.raw_app_meta_data->>'tenant_role', '')::public.tenant_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Unknown'),
    NEW.email,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
