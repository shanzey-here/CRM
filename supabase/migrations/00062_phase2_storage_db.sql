-- 00062_phase2_storage_db.sql
-- Storage & Crate Tracking — foundational schema only. No UI, no
-- billing/overdue-charge logic (a future crate-billing branch reads
-- expected_return_date; nothing here calculates or charges anything).

CREATE TYPE crate_status AS ENUM (
  'in_warehouse', 'reserved', 'with_customer', 'returned', 'lost', 'damaged'
);

CREATE TABLE storage_units (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_number         text NOT NULL,
  capacity_cubic_feet numeric NOT NULL, -- same unit already used by inventory_catalog/pricing
  is_available        boolean NOT NULL DEFAULT true,
  location_notes      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz,

  CONSTRAINT storage_units_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT storage_units_number_unique UNIQUE (tenant_id, unit_number)
);

CREATE TABLE crates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crate_number         text NOT NULL,
  status               crate_status NOT NULL DEFAULT 'in_warehouse',
  storage_unit_id      uuid, -- nullable: a crate with_customer isn't in any unit
  contact_id           uuid, -- nullable: not every crate is currently rented
  job_id               uuid, -- nullable: a rental can exist independent of any specific job
  rented_since         timestamptz,
  expected_return_date date, -- read by a future billing branch; nothing here uses it
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz,

  CONSTRAINT crates_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT crates_storage_unit_fk FOREIGN KEY (storage_unit_id, tenant_id) REFERENCES storage_units(id, tenant_id),
  CONSTRAINT crates_contact_fk FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts(id, tenant_id),
  CONSTRAINT crates_job_fk FOREIGN KEY (job_id, tenant_id) REFERENCES jobs(id, tenant_id)
);

CREATE INDEX idx_storage_units_tenant ON storage_units(tenant_id);
CREATE INDEX idx_crates_tenant ON crates(tenant_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON storage_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Partial unique index, not a flat table constraint: a lost/damaged crate
-- is a permanent write-off in this lifecycle (both are terminal states —
-- nothing transitions out of them), and its physical number tag is
-- realistically reissued to a replacement crate. Excluding those two
-- statuses from the uniqueness check means two simultaneously-*active*
-- crates can never collide on a number (a real data-entry error, still
-- caught), while a written-off crate's old number is free to reuse.
CREATE UNIQUE INDEX crates_number_unique_active ON crates (tenant_id, crate_number)
  WHERE status NOT IN ('lost', 'damaged');

-- Enable RLS
ALTER TABLE storage_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_units FORCE ROW LEVEL SECURITY;
ALTER TABLE crates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crates FORCE ROW LEVEL SECURITY;

-- Super Admin can do everything
CREATE POLICY super_admin_all ON storage_units
  FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY super_admin_all ON crates
  FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Admins and Dispatchers can do everything on their tenant's storage data —
-- operational data, not settings-level, so dispatcher is included (unlike
-- workflow-db's admin-only automation config).
CREATE POLICY admin_dispatcher_all ON storage_units
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

CREATE POLICY admin_dispatcher_all ON crates
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- No policies for 'crew' or 'customer'. They cannot access these tables.
