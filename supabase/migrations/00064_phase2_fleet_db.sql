-- ============================================================================
-- 1. ENUMS
-- ============================================================================
CREATE TYPE vehicle_document_type AS ENUM (
  'insurance',
  'mot',
  'registration',
  'service_invoice',
  'other'
);

CREATE TYPE vehicle_maintenance_type AS ENUM (
  'service',
  'repair',
  'tyre_change',
  'inspection',
  'other'
);

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- vehicle_documents
CREATE TABLE vehicle_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id     uuid NOT NULL,
  document_type  vehicle_document_type NOT NULL,
  expiry_date    date,
  file_path      text NOT NULL,
  uploaded_by    uuid NOT NULL REFERENCES users(id),
  uploaded_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vehicle_documents_vehicle_fk FOREIGN KEY (vehicle_id, tenant_id)
    REFERENCES vehicles(id, tenant_id)
);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for vehicle_documents"
  ON vehicle_documents
  FOR ALL
  USING (tenant_id = public.current_tenant_id());

-- vehicle_maintenance_records
CREATE TABLE vehicle_maintenance_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id       uuid NOT NULL,
  maintenance_type vehicle_maintenance_type NOT NULL,
  performed_at     date NOT NULL,
  cost             numeric(10,2),
  next_due_date    date,
  notes            text,
  logged_by        uuid NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vehicle_maintenance_records_vehicle_fk FOREIGN KEY (vehicle_id, tenant_id)
    REFERENCES vehicles(id, tenant_id)
);

ALTER TABLE vehicle_maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for vehicle_maintenance_records"
  ON vehicle_maintenance_records
  FOR ALL
  USING (tenant_id = public.current_tenant_id());

-- ============================================================================
-- 3. STORAGE BUCKET & RLS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Read Policy: tenant_admin, dispatcher, AND crew can read
-- MUST use auth.jwt() -> 'app_metadata' ->> 'tenant_id' to resolve reliably in Storage API context.
CREATE POLICY "Tenant staff can read their own vehicle documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'tenant_role') IN ('tenant_admin', 'dispatcher', 'crew')
);

-- Storage Insert Policy: ONLY tenant_admin and dispatcher can upload
CREATE POLICY "Tenant admins and dispatchers can upload vehicle documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-documents'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'tenant_role') IN ('tenant_admin', 'dispatcher')
);

-- Storage Update/Delete Policy: ONLY tenant_admin and dispatcher can modify/delete
CREATE POLICY "Tenant admins and dispatchers can update vehicle documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'tenant_role') IN ('tenant_admin', 'dispatcher')
);

CREATE POLICY "Tenant admins and dispatchers can delete vehicle documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'tenant_role') IN ('tenant_admin', 'dispatcher')
);
