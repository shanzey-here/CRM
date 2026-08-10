-- Follow-up backfill: admin@platform.com (id 99999999-9999-9999-9999-999999999999,
-- is_super_admin = true) was found in the same original orphan audit as
-- migration 20260810141500 but was NOT in the backfill scope selected at the
-- time. It turned out to be a real, actively-used super-admin login (not
-- just the tests/isolation_tests.sql fixture whose UUID it happens to
-- share), and hit the same platform_announcements_created_by_fkey error.
-- Confirmed via direct query before writing this: no public.users row exists
-- for this id.

INSERT INTO public.users (id, tenant_id, role, full_name, email, is_active)
VALUES
  ('99999999-9999-9999-9999-999999999999', NULL, NULL, 'admin@platform.com', 'admin@platform.com', true)
ON CONFLICT (id) DO NOTHING;
