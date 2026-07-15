-- ==============================================================================
-- 00005_phase1_contact_addresses.sql
-- Companion Migration for Address Management
-- ==============================================================================

CREATE TABLE contact_addresses (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id    uuid NOT NULL,
    address_id    uuid NOT NULL,
    label         text, -- e.g., 'home', 'billing', 'office'
    created_at    timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT contact_addresses_tenant_unique UNIQUE (id, tenant_id),
    CONSTRAINT contact_addresses_contact_fk FOREIGN KEY (contact_id, tenant_id)
        REFERENCES contacts(id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT contact_addresses_address_fk FOREIGN KEY (address_id, tenant_id)
        REFERENCES addresses(id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT contact_addresses_unique_link UNIQUE (contact_id, address_id, tenant_id)
);

-- RLS
ALTER TABLE contact_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_addresses_tenant_isolation" ON contact_addresses
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- Indexes for performance
CREATE INDEX idx_contact_addresses_contact ON contact_addresses(contact_id);
CREATE INDEX idx_contact_addresses_address ON contact_addresses(address_id);
