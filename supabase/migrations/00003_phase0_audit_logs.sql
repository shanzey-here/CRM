-- =============================================================================
-- Phase 0 — Audit Logging Schema
-- =============================================================================
-- Implements a generic audit logging system for tracking data mutations.
-- Captures row-level INSERT, UPDATE, and DELETE actions as JSON diffs.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- Grant usage to our API roles
GRANT USAGE ON SCHEMA audit TO anon, authenticated, service_role;

-- 1. Audit Logs Table
CREATE TABLE audit.logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid, -- No FK constraint to preserve history if tenant is deleted
  table_name  text NOT NULL,
  action      text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable to support service_role/system mutations
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_tenant_id ON audit.logs(tenant_id);
CREATE INDEX idx_audit_logs_table_name ON audit.logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit.logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;

-- 2. Audit Logs RLS Policies
-- Tenant Admins can view logs for their own tenant
CREATE POLICY "Tenant admins can view own audit logs" 
  ON audit.logs
  FOR SELECT
  USING (
    tenant_id = public.current_tenant_id() 
    AND public.current_user_role() = 'tenant_admin'
  );

-- Super admins can view everything
CREATE POLICY "Super admins can view all audit logs" 
  ON audit.logs
  FOR SELECT
  USING (public.is_super_admin() = true);

-- Nobody can manually insert/update/delete audit logs via the API.
-- (Only the trigger function running under SECURITY DEFINER can insert).

-- 3. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION audit.log_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges so it can insert into audit.logs regardless of RLS
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
    
    -- Dynamically extract tenant_id (or map 'id' if the table is 'tenants')
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

    -- Only log if something actually changed
    IF v_old_data IS DISTINCT FROM v_new_data THEN
      INSERT INTO audit.logs (tenant_id, table_name, action, old_data, new_data, user_id)
      VALUES (v_tenant_id, TG_TABLE_NAME, TG_OP, v_old_data, v_new_data, v_user_id);
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := row_to_json(OLD)::jsonb;

    IF TG_TABLE_NAME = 'tenants' THEN
      -- The tenant is being deleted, so we cannot reference its ID in the audit log
      -- due to the foreign key constraint. Log this as a platform-level event.
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

-- 4. Attach Triggers to Critical Tables
-- tenants
CREATE TRIGGER audit_tenants_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

-- users
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

-- tenant_settings
CREATE TRIGGER audit_tenant_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

-- TODO: Implement log retention cleanup (e.g. pg_cron deleting logs > 90 days)
