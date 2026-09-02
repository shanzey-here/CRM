-- Migration: 20260902090000_add_widget_detailed_form_fields
-- Web Widget redesign (feature/phase4-web-widget-detailed-form): the new
-- detailed quote-request form collects Title, house number, Property Type
-- (origin + destination), a packing preference, and a flexible preferred
-- start time. Per Decision 2 (confirmed before building): real typed
-- columns, not JSON/notes, so staff can filter/report on this data later
-- (e.g. "show me all Full Packing leads") — matches this codebase's existing
-- convention (priority, estimated_volume, etc. are all real columns).
--
-- All columns are nullable — every other address/contact/lead creation path
-- in the app (manual Create Client form, job/quote flows) doesn't collect
-- these fields and must keep working completely unchanged.

ALTER TABLE contacts ADD COLUMN title text
  CHECK (title IS NULL OR title IN ('Mr', 'Mrs', 'Miss', 'Dr', 'Prof'));

-- Property type is a property of the physical address (house/flat/office/
-- storage/shop), not of the lead, so it belongs on addresses — the existing
-- one-row-per-origin/destination pattern already gives the widget's two
-- property-type fields (origin, destination) for free with no new columns
-- on leads.
ALTER TABLE addresses ADD COLUMN property_type text
  CHECK (property_type IS NULL OR property_type IN ('house', 'flat', 'office', 'storage', 'shop'));

ALTER TABLE leads ADD COLUMN packing_preference text
  CHECK (packing_preference IS NULL OR packing_preference IN ('none', 'kitchen_fragile', 'full'));

ALTER TABLE leads ADD COLUMN preferred_move_time time;

-- brand-level accent color. brands.logo_url already exists for per-brand
-- identity; color was a real gap found during audit — tenant_settings.
-- primary_color exists but was deliberately kept tenant-wide (not
-- brand-level) by migration 20260815090000_add_brands_website_and_unify_branding,
-- so it cannot correctly serve a per-brand widget accent for a multi-brand
-- tenant. Nullable: the widget falls back to a neutral default in app code
-- when a brand hasn't set one, rather than writing a fake default color into
-- every existing brand row here.
ALTER TABLE brands ADD COLUMN color text
  CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
