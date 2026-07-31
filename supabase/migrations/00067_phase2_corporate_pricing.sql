-- Corporate pricing: a per-contact negotiated discount, applied as a
-- post-computation adjustment by the existing pricing engine's calling
-- code (src/modules/quotes/server/pricing.ts). calculate_quote_price()
-- itself is never modified — this is a data override layer only.

CREATE TABLE contact_pricing_overrides (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id        uuid NOT NULL,
  discount_percent  numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz,

  CONSTRAINT contact_pricing_overrides_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT contact_pricing_overrides_contact_unique UNIQUE (tenant_id, contact_id),
  CONSTRAINT contact_pricing_overrides_contact_fk FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts(id, tenant_id)
);

ALTER TABLE contact_pricing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_pricing_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON contact_pricing_overrides FOR ALL
  USING (public.is_super_admin() = true) WITH CHECK (public.is_super_admin() = true);

-- Both tenant_admin and dispatcher can see that a negotiated rate exists
-- (useful context on a quote/contact), but only tenant_admin can write —
-- same weight class as staff/billing, a customer-specific commercial
-- concession, not the tenant's own general rate configuration.
CREATE POLICY admin_dispatcher_select ON contact_pricing_overrides FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

CREATE POLICY admin_insert ON contact_pricing_overrides FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'tenant_admin');

CREATE POLICY admin_update ON contact_pricing_overrides FOR UPDATE
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'tenant_admin')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'tenant_admin');

-- Snapshot columns on quotes — null unless a negotiated rate was actually
-- applied at computation time; a contact with no override never touches
-- these, so pricing for every existing/unaffected contact is unchanged.
ALTER TABLE quotes ADD COLUMN standard_price numeric(12,2);
ALTER TABLE quotes ADD COLUMN negotiated_discount_percent numeric(5,2);
