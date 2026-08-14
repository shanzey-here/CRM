-- Migration: 20260815090000_add_brands_website_and_unify_branding
-- Closes a real gap found during verification: /office/settings/branding
-- and /office/settings/brands had become two fully independent data
-- sources (branding wrote to tenant_settings, brands owns its own table),
-- with no relationship between them — a tenant editing Branding reasonably
-- believed they were updating their business identity, but that edit had
-- zero effect anywhere real invoices/templates actually read from.
--
-- Resolution: Branding becomes a real edit surface for the tenant's
-- DEFAULT BRAND specifically (application-layer change, this migration
-- just adds the one missing field so nothing is lost in the switch).
-- tenant_settings keeps only what's genuinely tenant-wide and not brand
-- identity: primary_color (customer-portal accent color).

ALTER TABLE brands ADD COLUMN website text;

-- One-time carry-over so the default brand doesn't start blank for a field
-- tenant_settings already had real data in.
UPDATE brands b
SET website = ts.website
FROM tenant_settings ts
WHERE ts.tenant_id = b.tenant_id AND b.is_default = true AND ts.website IS NOT NULL;
