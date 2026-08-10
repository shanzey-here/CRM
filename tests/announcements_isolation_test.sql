-- =============================================================================
-- platform_announcements / tenant_announcement_dismissals — RLS verification
-- =============================================================================
-- Run via: supabase db query --linked -f tests/announcements_isolation_test.sql
--
-- Impersonates the REAL seeded dev accounts (scripts/seed-dev-accounts.ts +
-- scripts/seed-announcements-extra-accounts.ts) rather than synthetic fixture
-- UUIDs, because audit.logs.user_id has a hard FK to auth.users(id) and
-- synthetic IDs that don't exist there fail that FK the moment any audited
-- table (platform_announcements) is touched under an impersonated role.
--
-- Only the announcement rows themselves are test fixtures, scoped to their
-- own hardcoded IDs and cleaned up before/after — never touching real users
-- or tenants created by the seed scripts.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS tests;

-- Scratch results table so PASS/FAIL is visible in `supabase db query`'s JSON
-- output (server RAISE NOTICE/WARNING logs aren't returned over that API).
-- Ephemeral scratch state only — cleared at the start of every run.
CREATE TABLE IF NOT EXISTS tests.results (
  id serial PRIMARY KEY,
  test_name text,
  status text,
  detail text
);
TRUNCATE tests.results;

CREATE OR REPLACE FUNCTION tests.set_jwt_claims(
  p_user_id uuid, p_tenant_id uuid, p_role text, p_is_super_admin boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_claims json;
BEGIN
  v_claims := json_build_object(
    'sub', p_user_id::text,
    'app_metadata', json_build_object(
      'tenant_id', CASE WHEN p_tenant_id IS NULL THEN NULL ELSE p_tenant_id::text END,
      'tenant_role', p_role,
      'is_super_admin', p_is_super_admin
    )
  );
  PERFORM set_config('request.jwt.claims', v_claims::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION tests.assert_count(p_test_name text, p_actual bigint, p_expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual = p_expected THEN
    INSERT INTO tests.results (test_name, status, detail) VALUES (p_test_name, 'PASS', format('got %s, expected %s', p_actual, p_expected));
  ELSE
    INSERT INTO tests.results (test_name, status, detail) VALUES (p_test_name, 'FAIL', format('got %s, expected %s', p_actual, p_expected));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION tests.assert_raises(p_test_name text, p_sql text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO tests.results (test_name, status, detail) VALUES (p_test_name, 'FAIL', 'expected an error but statement succeeded');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO tests.results (test_name, status, detail) VALUES (p_test_name, 'PASS', format('got expected error: %s', SQLERRM));
END;
$$;

-- =============================================================================
-- Real seeded dev accounts (from scripts/seed-dev-accounts.ts +
-- scripts/seed-announcements-extra-accounts.ts). Fetched at script-write time;
-- re-run the seed scripts first if these ever change.
--   super-admin@devtest.local     01111717-7fff-4846-8d00-b8ae72bc888d   (no tenant)
--   admin@devtest.local           b1938c3a-4c4e-41bb-8f1b-c70af9f5df59   tenant_admin, Tenant A
--   admin2@devtest.local          ae8a556a-798b-4aca-89c9-5be69658bdc8   tenant_admin, Tenant A
--   dispatcher@devtest.local      692c5fea-f299-4458-a49a-1615d6fdc5f1   dispatcher,   Tenant A
--   crew@devtest.local            4b91ec16-a7b4-48b0-8ed2-479674e1a43e   crew,         Tenant A
--   customer@devtest.local        f51cc82a-07a7-4e9c-82e7-3284636eef15   customer,     Tenant A
--   admin@second-dev-removals.local a46ee8f4-00be-4bf5-8023-e779abe6ed92 tenant_admin, Tenant B
--   Tenant A (dev-test-removals):    edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1
--   Tenant B (second-dev-removals):  75a3244b-6f67-456a-9ad0-010a5287a1c2
-- =============================================================================

DO $$
DECLARE
  v_ann_dismissible uuid := 'a1111111-3333-3333-3333-333333333333';
  v_ann_not_dismissible uuid := 'a2222222-3333-3333-3333-333333333333';
  v_super_admin uuid := '01111717-7fff-4846-8d00-b8ae72bc888d';
BEGIN
  DELETE FROM public.tenant_announcement_dismissals WHERE announcement_id IN (v_ann_dismissible, v_ann_not_dismissible);
  DELETE FROM public.platform_announcements WHERE id IN (v_ann_dismissible, v_ann_not_dismissible);

  INSERT INTO platform_announcements (id, title, body, severity, target_type, target_ids, dismissible, created_by)
  VALUES
    (v_ann_dismissible, 'RLS test: dismissible', 'body', 'info', 'all_tenants', '{}', true, v_super_admin),
    (v_ann_not_dismissible, 'RLS test: non-dismissible', 'body', 'critical', 'all_tenants', '{}', false, v_super_admin);

  RAISE NOTICE 'Announcements RLS test fixtures created.';
END;
$$;

-- The assert_* helpers and set_jwt_claims must be callable, and tests.results
-- writable, from the `authenticated` role we switch to below.
GRANT USAGE ON SCHEMA tests TO authenticated;
GRANT EXECUTE ON FUNCTION tests.set_jwt_claims(uuid, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION tests.assert_count(text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION tests.assert_raises(text, text) TO authenticated;
GRANT INSERT ON tests.results TO authenticated;
GRANT USAGE ON SEQUENCE tests.results_id_seq TO authenticated;

-- The `supabase db query --linked` connection is a superuser-equivalent role
-- that BYPASSES RLS entirely, regardless of request.jwt.claims — impersonation
-- alone (as the original tests/isolation_tests.sql assumed) proves nothing
-- unless the session is actually running as a non-bypassing role. Switch to
-- the real `authenticated` Postgres role (same one PostgREST uses for every
-- logged-in request) so RLS is genuinely enforced for the tests below.
SET ROLE authenticated;

-- =============================================================================
-- TEST 1 (Fix #1): SELECT — super_admin and tenant_admin can read; dispatcher,
-- crew, customer get ZERO rows. This is the direct-query enforcement check.
-- =============================================================================
DO $$
DECLARE v_count bigint;
BEGIN
  PERFORM tests.set_jwt_claims('01111717-7fff-4846-8d00-b8ae72bc888d', NULL, NULL, true);
  SELECT count(*) INTO v_count FROM platform_announcements WHERE id IN ('a1111111-3333-3333-3333-333333333333', 'a2222222-3333-3333-3333-333333333333');
  PERFORM tests.assert_count('super_admin can SELECT platform_announcements', v_count, 2);

  PERFORM tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'tenant_admin');
  SELECT count(*) INTO v_count FROM platform_announcements WHERE id IN ('a1111111-3333-3333-3333-333333333333', 'a2222222-3333-3333-3333-333333333333');
  PERFORM tests.assert_count('tenant_admin can SELECT platform_announcements', v_count, 2);

  PERFORM tests.set_jwt_claims('692c5fea-f299-4458-a49a-1615d6fdc5f1', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'dispatcher');
  SELECT count(*) INTO v_count FROM platform_announcements WHERE id IN ('a1111111-3333-3333-3333-333333333333', 'a2222222-3333-3333-3333-333333333333');
  PERFORM tests.assert_count('dispatcher CANNOT SELECT platform_announcements (RLS blocks direct query)', v_count, 0);

  PERFORM tests.set_jwt_claims('4b91ec16-a7b4-48b0-8ed2-479674e1a43e', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'crew');
  SELECT count(*) INTO v_count FROM platform_announcements WHERE id IN ('a1111111-3333-3333-3333-333333333333', 'a2222222-3333-3333-3333-333333333333');
  PERFORM tests.assert_count('crew CANNOT SELECT platform_announcements (RLS blocks direct query)', v_count, 0);

  PERFORM tests.set_jwt_claims('f51cc82a-07a7-4e9c-82e7-3284636eef15', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'customer');
  SELECT count(*) INTO v_count FROM platform_announcements WHERE id IN ('a1111111-3333-3333-3333-333333333333', 'a2222222-3333-3333-3333-333333333333');
  PERFORM tests.assert_count('customer CANNOT SELECT platform_announcements (RLS blocks direct query)', v_count, 0);
END;
$$;

-- =============================================================================
-- TEST 2: only super_admin can write platform_announcements — tenant_admin
-- cannot insert/update even though it can read.
-- =============================================================================
SELECT tests.assert_raises(
  'tenant_admin cannot INSERT platform_announcements',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    INSERT INTO platform_announcements (title, body, created_by) VALUES ('hack', 'hack', 'b1938c3a-4c4e-41bb-8f1b-c70af9f5df59');
  $$
);

DO $$
BEGIN
  PERFORM tests.set_jwt_claims('01111717-7fff-4846-8d00-b8ae72bc888d'::uuid, NULL, NULL, true);
  UPDATE platform_announcements SET title = 'Updated by super admin' WHERE id = 'a1111111-3333-3333-3333-333333333333';
  INSERT INTO tests.results (test_name, status) VALUES ('super_admin can UPDATE platform_announcements', 'PASS');
END;
$$;

-- =============================================================================
-- TEST 3 (Fix #2): dismissal INSERT — tenant_admin can dismiss a dismissible
-- announcement; rejected for a non-dismissible one even as tenant_admin.
-- =============================================================================
DO $$
BEGIN
  PERFORM tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
  INSERT INTO tenant_announcement_dismissals (announcement_id, tenant_id, user_id)
  VALUES ('a1111111-3333-3333-3333-333333333333', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'b1938c3a-4c4e-41bb-8f1b-c70af9f5df59');
  INSERT INTO tests.results (test_name, status) VALUES ('tenant_admin can dismiss a dismissible announcement', 'PASS');
END;
$$;

SELECT tests.assert_raises(
  'tenant_admin CANNOT dismiss a non-dismissible announcement (Fix #2 EXISTS check)',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    INSERT INTO tenant_announcement_dismissals (announcement_id, tenant_id, user_id)
    VALUES ('a2222222-3333-3333-3333-333333333333', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'b1938c3a-4c4e-41bb-8f1b-c70af9f5df59');
  $$
);

SELECT tests.assert_raises(
  'dispatcher CANNOT dismiss any announcement (role check)',
  $$
    SELECT tests.set_jwt_claims('692c5fea-f299-4458-a49a-1615d6fdc5f1'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'dispatcher');
    INSERT INTO tenant_announcement_dismissals (announcement_id, tenant_id, user_id)
    VALUES ('a1111111-3333-3333-3333-333333333333', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', '692c5fea-f299-4458-a49a-1615d6fdc5f1');
  $$
);

SELECT tests.assert_raises(
  'crew CANNOT dismiss any announcement (role check)',
  $$
    SELECT tests.set_jwt_claims('4b91ec16-a7b4-48b0-8ed2-479674e1a43e'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'crew');
    INSERT INTO tenant_announcement_dismissals (announcement_id, tenant_id, user_id)
    VALUES ('a1111111-3333-3333-3333-333333333333', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', '4b91ec16-a7b4-48b0-8ed2-479674e1a43e');
  $$
);

SELECT tests.assert_raises(
  'tenant_admin CANNOT dismiss on behalf of another user (user_id must be auth.uid())',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    INSERT INTO tenant_announcement_dismissals (announcement_id, tenant_id, user_id)
    VALUES ('a1111111-3333-3333-3333-333333333333', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'ae8a556a-798b-4aca-89c9-5be69658bdc8');
  $$
);

-- =============================================================================
-- TEST 4: a tenant_admin can only read their OWN dismissal rows — proves the
-- "second admin at the same tenant still sees an announcement the first
-- admin dismissed" requirement at the RLS level.
-- =============================================================================
DO $$
DECLARE v_count bigint;
BEGIN
  -- admin2 (same tenant, different user) has NOT dismissed it — reads own rows only, sees 0.
  PERFORM tests.set_jwt_claims('ae8a556a-798b-4aca-89c9-5be69658bdc8'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
  SELECT count(*) INTO v_count FROM tenant_announcement_dismissals WHERE announcement_id = 'a1111111-3333-3333-3333-333333333333';
  PERFORM tests.assert_count('admin2 (same tenant) does not see admin''s dismissal row (per-user)', v_count, 0);

  -- Tenant B admin (different tenant entirely) also sees 0.
  PERFORM tests.set_jwt_claims('a46ee8f4-00be-4bf5-8023-e779abe6ed92'::uuid, '75a3244b-6f67-456a-9ad0-010a5287a1c2'::uuid, 'tenant_admin');
  SELECT count(*) INTO v_count FROM tenant_announcement_dismissals WHERE announcement_id = 'a1111111-3333-3333-3333-333333333333';
  PERFORM tests.assert_count('tenant B admin cannot see tenant A admin dismissal row', v_count, 0);

  -- admin (the one who dismissed it) sees their own row.
  PERFORM tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
  SELECT count(*) INTO v_count FROM tenant_announcement_dismissals WHERE announcement_id = 'a1111111-3333-3333-3333-333333333333';
  PERFORM tests.assert_count('admin (who dismissed) can see own dismissal row', v_count, 1);
END;
$$;

-- Back to the privileged connection role for cleanup — it must be able to
-- delete these fixture rows regardless of what RLS would allow "authenticated"
-- (impersonating whichever role the last test left active) to do.
RESET ROLE;

-- =============================================================================
-- CLEANUP — remove test data (runs unconditionally)
-- =============================================================================
DO $$
DECLARE
  v_ann_dismissible uuid := 'a1111111-3333-3333-3333-333333333333';
  v_ann_not_dismissible uuid := 'a2222222-3333-3333-3333-333333333333';
BEGIN
  DELETE FROM public.tenant_announcement_dismissals WHERE announcement_id IN (v_ann_dismissible, v_ann_not_dismissible);
  DELETE FROM public.platform_announcements WHERE id IN (v_ann_dismissible, v_ann_not_dismissible);
  INSERT INTO tests.results (test_name, status) VALUES ('cleanup', 'DONE');
END;
$$;

-- Final statement — its result rows are what `supabase db query --linked -f`
-- returns, since server-side NOTICE/WARNING logs aren't surfaced over the API.
SELECT id, test_name, status, detail FROM tests.results ORDER BY id;
