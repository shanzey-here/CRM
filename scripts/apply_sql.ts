import { Client } from 'pg'

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  })

  try {
    await client.connect()
    console.log('Connected to local Postgres.')

    const sql = `
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
  -- FIX: Correctly extract the User ID from the JWT claims subject
  SELECT role, tenant_id INTO v_role, v_tenant_id
  FROM public.users
  WHERE id = (event->'claims'->>'sub')::uuid;

  claims := event->'claims';

  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, tenant_role}', to_jsonb(v_role));
  ELSE
    claims := claims #- '{app_metadata, tenant_role}';
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, tenant_id}', to_jsonb(v_tenant_id));
  ELSE
    claims := claims #- '{app_metadata, tenant_id}';
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  
  RETURN event;
END;
$$;
`
    await client.query(sql)
    console.log('SQL applied successfully!')
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
  }
}

run()
