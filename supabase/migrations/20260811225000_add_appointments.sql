CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "Tenant users can view their appointments"
ON appointments FOR SELECT
USING (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

CREATE POLICY "Tenant users can insert their appointments"
ON appointments FOR INSERT
WITH CHECK (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

CREATE POLICY "Tenant users can update their appointments"
ON appointments FOR UPDATE
USING (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid)
WITH CHECK (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

CREATE POLICY "Tenant users can delete their appointments"
ON appointments FOR DELETE
USING (tenant_id = (SELECT auth.jwt()->>'tenant_id')::uuid);

-- Indexes for performance
CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_appointments_time ON appointments(tenant_id, start_time, end_time);
