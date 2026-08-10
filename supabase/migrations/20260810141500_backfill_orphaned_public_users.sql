-- One-off backfill for the two real accounts confirmed (via direct query
-- against auth.users, see chat history / PR description) to be missing a
-- public.users row as of 2026-08-10, before the on_auth_user_created trigger
-- (migration 20260810140000) existed to prevent this going forward.
--
-- Explicitly scoped to these two accounts by id — reviewed and confirmed
-- with the user before running, not a blanket backfill of every orphaned
-- auth.users row (several others found in the same audit are unexplained
-- test fixtures from unrelated test suites and were deliberately left
-- untouched).

INSERT INTO public.users (id, tenant_id, role, full_name, email, is_active)
VALUES
  -- superadmin@gomove.com — real super admin, app_metadata.is_super_admin = true,
  -- no tenant_id/tenant_role. This is the account that hit
  -- platform_announcements_created_by_fkey.
  ('9d4fbac2-c0a0-490d-8c4f-fb057697e168', NULL, NULL, 'superadmin@gomove.com', 'superadmin@gomove.com', true),
  -- qa@gomove.com — real dispatcher on tenant d0000000-0000-0000-0000-00000000000d
  -- ("Dev Test Removals" / dev-test), per its actual app_metadata.
  ('215f12bc-49e3-4763-9210-6265ba2f24bf', 'd0000000-0000-0000-0000-00000000000d', 'dispatcher', 'qa@gomove.com', 'qa@gomove.com', true)
ON CONFLICT (id) DO NOTHING;
