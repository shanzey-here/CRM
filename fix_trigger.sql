CREATE OR REPLACE FUNCTION audit.log_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_data jsonb := NULL;
  v_new_data jsonb := NULL;
  v_tenant_id uuid := NULL;
  v_user_id uuid;
BEGIN
  -- Null-guard auth.uid() for system mutations (e.g. from edge functions or service_role)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_new_data := row_to_json(NEW)::jsonb;
    IF TG_TABLE_NAME = 'tenants' THEN
      v_tenant_id := NEW.id;
    ELSIF v_new_data ? 'tenant_id' THEN
      v_tenant_id := (v_new_data->>'tenant_id')::uuid;
    END IF;
    INSERT INTO audit.logs (tenant_id, table_name, action, new_data, user_id)
    VALUES (v_tenant_id, TG_TABLE_NAME, TG_OP, v_new_data, v_user_id);
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := row_to_json(OLD)::jsonb;
    v_new_data := row_to_json(NEW)::jsonb;
    IF TG_TABLE_NAME = 'tenants' THEN
      v_tenant_id := NEW.id;
    ELSIF v_new_data ? 'tenant_id' THEN
      v_tenant_id := (v_new_data->>'tenant_id')::uuid;
    END IF;
    IF v_old_data IS DISTINCT FROM v_new_data THEN
      INSERT INTO audit.logs (tenant_id, table_name, action, old_data, new_data, user_id)
      VALUES (v_tenant_id, TG_TABLE_NAME, TG_OP, v_old_data, v_new_data, v_user_id);
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := row_to_json(OLD)::jsonb;
    IF TG_TABLE_NAME = 'tenants' THEN
      v_tenant_id := NULL;
    ELSIF v_old_data ? 'tenant_id' THEN
      v_tenant_id := (v_old_data->>'tenant_id')::uuid;
    END IF;
    INSERT INTO audit.logs (tenant_id, table_name, action, old_data, user_id)
    VALUES (v_tenant_id, TG_TABLE_NAME, TG_OP, v_old_data, v_user_id);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;
