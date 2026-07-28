import { createClient } from '@supabase/supabase-js'

async function run() {
  const supabaseUrl = 'https://vowdhcwsuhjclyjusigu.supabase.co'
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvd2RoY3dzdWhqY2x5anVzaWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAyMTQwOCwiZXhwIjoyMDk5NTk3NDA4fQ.UKq0j9U8PddXBCZ_fo1JgApvE95N7RV-FwQWy3ceGjU'

  const supabase = createClient(supabaseUrl, serviceRoleKey)

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

  console.log('Applying SQL to remote Supabase project...')
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })
  
  if (error) {
    console.error('Failed via RPC (exec_sql might not exist):', error.message)
    console.log('\nPlease apply this SQL manually in the Supabase Dashboard SQL Editor:')
    console.log(sql)
  } else {
    console.log('SQL applied successfully via RPC!')
  }
}

run()
