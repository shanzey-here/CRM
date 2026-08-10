-- =============================================================================
-- email_labels / email_label_assignments / email_label_suggestions — RLS +
-- constraint verification. Run via:
--   supabase db query --linked -f tests/email_labels_isolation_test.sql
--
-- Impersonates the REAL seeded dev accounts (same ones used by the
-- announcements feature's own isolation test) — audit.logs.user_id has a
-- hard FK to auth.users(id), so synthetic fixture UUIDs fail that FK the
-- moment any audited table is touched under an impersonated role.
--
-- Uses REAL existing email_threads on the real dev-test-removals tenant
-- (35 real synced threads exist; second-dev-removals has none) — no thread
-- fixtures are created. Only label rows are test fixtures, scoped to their
-- own hardcoded IDs and cleaned up before/after.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS tests;

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

GRANT USAGE ON SCHEMA tests TO authenticated;
GRANT EXECUTE ON FUNCTION tests.set_jwt_claims(uuid, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION tests.assert_count(text, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION tests.assert_raises(text, text) TO authenticated;
GRANT INSERT ON tests.results TO authenticated;
GRANT USAGE ON SEQUENCE tests.results_id_seq TO authenticated;

-- =============================================================================
-- Real accounts (from scripts/seed-dev-accounts.ts + seed-announcements-extra-accounts.ts):
--   admin@devtest.local            b1938c3a-4c4e-41bb-8f1b-c70af9f5df59   tenant_admin, Tenant A (edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1)
--   dispatcher@devtest.local       692c5fea-f299-4458-a49a-1615d6fdc5f1   dispatcher,   Tenant A
--   crew@devtest.local             4b91ec16-a7b4-48b0-8ed2-479674e1a43e   crew,         Tenant A
--   admin@second-dev-removals.local a46ee8f4-00be-4bf5-8023-e779abe6ed92 tenant_admin, Tenant B (75a3244b-6f67-456a-9ad0-010a5287a1c2)
-- Real Tenant A thread (one of 35 genuinely synced ones): 2a8948cf-ad13-49df-94bb-385d6d6c897c ("Testing mail 1")
-- =============================================================================

DO $$
DECLARE
  v_label_a uuid := 'e1111111-4444-4444-4444-444444444444';
  v_label_a2 uuid := 'e2222222-4444-4444-4444-444444444444';
  v_default_label_a uuid;
BEGIN
  DELETE FROM public.email_label_assignments WHERE label_id IN (v_label_a, v_label_a2);
  DELETE FROM public.email_labels WHERE id IN (v_label_a, v_label_a2);

  INSERT INTO email_labels (id, tenant_id, name, color_hex, is_default)
  VALUES (v_label_a, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'RLS Test Label', '#123456', false);

  SELECT id INTO v_default_label_a FROM email_labels
    WHERE tenant_id = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1' AND name = 'New Lead' AND is_default = true;

  RAISE NOTICE 'Fixtures ready. Default "New Lead" label id: %', v_default_label_a;
END;
$$;

SET ROLE authenticated;

-- =============================================================================
-- TEST 1: RLS SELECT — tenant_admin/dispatcher can read own-tenant labels;
-- crew gets ZERO rows (matches the email module's own admin_dispatcher_all
-- policy shape — crew has no email access at all).
-- =============================================================================
DO $$
DECLARE v_count bigint;
BEGIN
  PERFORM tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'tenant_admin');
  SELECT count(*) INTO v_count FROM email_labels WHERE tenant_id = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1';
  PERFORM tests.assert_count('tenant_admin sees own tenant labels (8 default + 1 fixture)', v_count, 9);

  PERFORM tests.set_jwt_claims('692c5fea-f299-4458-a49a-1615d6fdc5f1', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'dispatcher');
  SELECT count(*) INTO v_count FROM email_labels WHERE tenant_id = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1';
  PERFORM tests.assert_count('dispatcher sees own tenant labels too', v_count, 9);

  PERFORM tests.set_jwt_claims('4b91ec16-a7b4-48b0-8ed2-479674e1a43e', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'crew');
  SELECT count(*) INTO v_count FROM email_labels WHERE tenant_id = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1';
  PERFORM tests.assert_count('crew CANNOT see email labels (no email access at all)', v_count, 0);
END;
$$;

-- =============================================================================
-- TEST 2: cross-tenant label isolation (verification item 7)
-- =============================================================================
DO $$
DECLARE v_count bigint;
BEGIN
  PERFORM tests.set_jwt_claims('a46ee8f4-00be-4bf5-8023-e779abe6ed92', '75a3244b-6f67-456a-9ad0-010a5287a1c2', 'tenant_admin');
  SELECT count(*) INTO v_count FROM email_labels WHERE tenant_id = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1';
  PERFORM tests.assert_count('Tenant B admin cannot see Tenant A labels', v_count, 0);

  SELECT count(*) INTO v_count FROM email_labels WHERE tenant_id = '75a3244b-6f67-456a-9ad0-010a5287a1c2';
  PERFORM tests.assert_count('Tenant B admin sees own tenant''s 8 default labels', v_count, 8);
END;
$$;

-- =============================================================================
-- TEST 3 (FIX #1): composite thread_id FK blocks cross-tenant assignment —
-- tenant_id = Tenant B but thread_id = a REAL Tenant A thread must be rejected.
-- =============================================================================
SELECT tests.assert_raises(
  'FIX #1: cannot assign a label with tenant_id=Tenant B but thread_id from Tenant A (composite FK)',
  $$
    SELECT tests.set_jwt_claims('a46ee8f4-00be-4bf5-8023-e779abe6ed92'::uuid, '75a3244b-6f67-456a-9ad0-010a5287a1c2'::uuid, 'tenant_admin');
    INSERT INTO email_label_assignments (thread_id, label_id, tenant_id, applied_by)
    SELECT '2a8948cf-ad13-49df-94bb-385d6d6c897c', id, '75a3244b-6f67-456a-9ad0-010a5287a1c2', 'a46ee8f4-00be-4bf5-8023-e779abe6ed92'
    FROM email_labels WHERE tenant_id = '75a3244b-6f67-456a-9ad0-010a5287a1c2' LIMIT 1;
  $$
);

-- =============================================================================
-- TEST 4: real, correctly-scoped assignment succeeds — Tenant A admin
-- assigns the fixture label to a real Tenant A thread.
-- =============================================================================
DO $$
BEGIN
  PERFORM tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
  INSERT INTO email_label_assignments (thread_id, label_id, tenant_id, applied_by)
  VALUES ('2a8948cf-ad13-49df-94bb-385d6d6c897c', 'e1111111-4444-4444-4444-444444444444', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'b1938c3a-4c4e-41bb-8f1b-c70af9f5df59');
  INSERT INTO tests.results (test_name, status) VALUES ('Correctly-scoped label assignment succeeds', 'PASS');
END;
$$;

-- =============================================================================
-- TEST 5 (FIX #2): deleting a custom label CASCADEs to its assignments
-- instead of throwing a raw FK-violation.
-- =============================================================================
DO $$
DECLARE v_count bigint;
BEGIN
  PERFORM tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
  DELETE FROM email_labels WHERE id = 'e1111111-4444-4444-4444-444444444444';
  SELECT count(*) INTO v_count FROM email_label_assignments WHERE label_id = 'e1111111-4444-4444-4444-444444444444';
  PERFORM tests.assert_count('FIX #2: deleting an in-use custom label cascades (no raw FK error, no orphan)', v_count, 0);
END;
$$;

-- =============================================================================
-- TEST 6: default label delete is rejected server-side (DB trigger), even
-- for a real default label ("New Lead"), even via direct API bypass.
-- =============================================================================
SELECT tests.assert_raises(
  'Cannot delete a default label, even as tenant_admin, even bypassing the UI',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    DELETE FROM email_labels WHERE tenant_id = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1' AND name = 'New Lead' AND is_default = true;
  $$
);

-- =============================================================================
-- TEST 7: color AND name uniqueness constraints, real Postgres 23505 —
-- item 8's "direct API call bypassing the form" proof.
-- =============================================================================
SELECT tests.assert_raises(
  'Cannot create a second label with an already-used color (real 23505, not client validation)',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    INSERT INTO email_labels (tenant_id, name, color_hex, is_default)
    VALUES ('edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'Totally Different Name', '#3B82F6', false); -- #3B82F6 = "New Lead"'s real color
  $$
);

SELECT tests.assert_raises(
  'Cannot create a second label with an already-used name (case-insensitive)',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    INSERT INTO email_labels (tenant_id, name, color_hex, is_default)
    VALUES ('edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'new lead', '#010203', false);
  $$
);

SELECT tests.assert_raises(
  'color_hex format is validated at the DB level (CHECK constraint)',
  $$
    SELECT tests.set_jwt_claims('b1938c3a-4c4e-41bb-8f1b-c70af9f5df59'::uuid, 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'::uuid, 'tenant_admin');
    INSERT INTO email_labels (tenant_id, name, color_hex, is_default)
    VALUES ('edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1', 'Bad Color Label', 'not-a-hex-color', false);
  $$
);

RESET ROLE;

-- =============================================================================
-- CLEANUP
-- =============================================================================
DO $$
DECLARE
  v_label_a uuid := 'e1111111-4444-4444-4444-444444444444';
  v_label_a2 uuid := 'e2222222-4444-4444-4444-444444444444';
BEGIN
  DELETE FROM public.email_label_assignments WHERE label_id IN (v_label_a, v_label_a2);
  DELETE FROM public.email_labels WHERE id IN (v_label_a, v_label_a2);
  INSERT INTO tests.results (test_name, status) VALUES ('cleanup', 'DONE');
END;
$$;

SELECT id, test_name, status, detail FROM tests.results ORDER BY id;
