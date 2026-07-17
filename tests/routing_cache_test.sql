BEGIN;

\echo '--- Testing route_cache RLS ---'

-- Create test tenant and users
WITH new_tenant AS (
  INSERT INTO public.tenants (name, slug) VALUES ('Route Test Tenant', 'route-test') RETURNING id
),
u1 AS (
  INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'admin@route.com') RETURNING id
),
u2 AS (
  INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'crew@route.com') RETURNING id
)
INSERT INTO public.users (id, tenant_id, email, full_name, tenant_role)
SELECT u1.id, new_tenant.id, 'admin@route.com', 'Admin User', 'tenant_admin' FROM u1, new_tenant
UNION ALL
SELECT u2.id, new_tenant.id, 'crew@route.com', 'Crew User', 'crew' FROM u2, new_tenant;

\echo '1. Crew user cannot insert into route_cache'
-- Impersonate crew
SELECT set_config('request.jwt.claims', (
  SELECT json_build_object(
    'sub', u.id,
    'app_metadata', json_build_object('tenant_id', u.tenant_id)
  )::text
  FROM public.users u WHERE email = 'crew@route.com'
), true);

DO $$
BEGIN
  INSERT INTO public.route_cache (origin_key, destination_key, distance_meters, duration_seconds)
  VALUES ('O1', 'D1', 1000, 600);
  RAISE EXCEPTION 'Crew should not be able to insert';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '✅ Crew correctly blocked from inserting';
END $$;

\echo '2. Admin user can insert and read route_cache'
SELECT set_config('request.jwt.claims', (
  SELECT json_build_object(
    'sub', u.id,
    'app_metadata', json_build_object('tenant_id', u.tenant_id)
  )::text
  FROM public.users u WHERE email = 'admin@route.com'
), true);

INSERT INTO public.route_cache (origin_key, destination_key, distance_meters, duration_seconds)
VALUES ('O1', 'D1', 1000, 600);
RAISE NOTICE '✅ Admin inserted route';

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.route_cache WHERE origin_key = 'O1';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Admin cannot read inserted route';
  END IF;
  RAISE NOTICE '✅ Admin can read route';
END $$;

\echo '3. Crew user cannot read route_cache'
SELECT set_config('request.jwt.claims', (
  SELECT json_build_object(
    'sub', u.id,
    'app_metadata', json_build_object('tenant_id', u.tenant_id)
  )::text
  FROM public.users u WHERE email = 'crew@route.com'
), true);

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.route_cache WHERE origin_key = 'O1';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Crew should not be able to read route_cache';
  END IF;
  RAISE NOTICE '✅ Crew correctly blocked from reading';
END $$;

ROLLBACK;
