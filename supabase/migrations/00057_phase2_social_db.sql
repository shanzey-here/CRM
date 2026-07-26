-- 00057_phase2_social_db.sql
-- Create schema for connected social accounts

CREATE TABLE connected_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform text NOT NULL, -- e.g., 'facebook', 'instagram', 'linkedin'
  aggregator_profile_id text NOT NULL, -- The opaque profile ID from the aggregator (e.g., Ayrshare profile key)
  display_name text NOT NULL, -- For UI display (e.g., "Gomove Facebook Page")
  is_active boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,

  CONSTRAINT connected_social_accounts_unique UNIQUE (tenant_id, platform, aggregator_profile_id)
);

CREATE INDEX idx_connected_social_accounts_tenant ON connected_social_accounts(tenant_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON connected_social_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE connected_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_social_accounts FORCE ROW LEVEL SECURITY;

-- Super Admin can do everything
CREATE POLICY super_admin_all ON connected_social_accounts
  FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Admins and Dispatchers can do everything on their tenant's social accounts
CREATE POLICY admin_dispatcher_all ON connected_social_accounts
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id() 
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id() 
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- No policies for 'crew' or 'customer'. They cannot access this table.
