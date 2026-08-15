-- Migration: 20260814090000_add_brands_and_thread_brand_id
-- Multi-brand support. NOT tenant isolation: one tenant can run multiple
-- public-facing businesses (different name/logo/email/domain) as one shared
-- operation (same staff, scheduling, pricing, Stripe account). brand_id is an
-- identity label that rides along with a record, never a second RLS
-- boundary — every policy below still scopes by tenant_id exactly as today.

-- =============================================================================
-- 1. brands table
-- =============================================================================
-- Field granularity matches tenant_settings' existing branding fields
-- exactly (address_line_1/2/city/county/postcode/country, vat_number,
-- logo_url, email) rather than inventing a single free-text address field —
-- same shape, same convention, so the settings UI can reuse the same form
-- pattern as Branding. bank_details/terms_text are genuinely new (no prior
-- column anywhere holds bank details). public_widget_key mirrors
-- tenants.public_widget_key's exact shape (uuid, unique, random default) so
-- the existing widget lookup mechanism is reused unchanged, just re-scoped.

CREATE TABLE brands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  logo_url          text,
  email             text,
  phone             text,
  address_line_1    text,
  address_line_2    text,
  address_city      text,
  address_county    text,
  address_postcode  text,
  address_country   text,
  vat_number        text,
  bank_details      text,
  terms_text        text,
  public_widget_key uuid NOT NULL DEFAULT gen_random_uuid(),
  is_default        boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);

CREATE INDEX idx_brands_tenant_id ON brands(tenant_id);
CREATE UNIQUE INDEX idx_brands_public_widget_key ON brands(public_widget_key);
-- At most one default brand per tenant — the resolution target for
-- back-compat lookups (widget key backfill, "no brand selector needed"
-- single-brand UX, legacy-data fallback).
CREATE UNIQUE INDEX idx_brands_one_default_per_tenant ON brands(tenant_id) WHERE is_default = true;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands FORCE ROW LEVEL SECURITY;

-- Same shape as invoice_templates/mailboxes/pricing_settings: internal
-- config, admin/dispatcher-facing only. Customer-facing surfaces never read
-- this table directly — issued invoices read their own frozen
-- brand_snapshot (below), never a live brands join.
CREATE POLICY super_admin_all ON brands FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON brands FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

-- =============================================================================
-- 2. Backfill: every existing tenant gets one default brand, seeded from
--    their real current tenant_settings + real current public_widget_key —
--    so an existing single-brand tenant's invoices/widget snippet keep
--    working completely unchanged.
-- =============================================================================

INSERT INTO brands (
  tenant_id, name, logo_url, email, phone,
  address_line_1, address_line_2, address_city, address_county, address_postcode, address_country,
  vat_number, terms_text, public_widget_key, is_default
)
SELECT
  t.id,
  COALESCE(ts.company_legal_name, 'Default Brand'),
  ts.logo_url, ts.email, ts.phone,
  ts.address_line_1, ts.address_line_2, ts.address_city, ts.address_county, ts.address_postcode, ts.address_country,
  ts.vat_number, ts.terms_template, t.public_widget_key, true
FROM tenants t
LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id;

-- =============================================================================
-- 3. invoice_templates becomes brand-owned (was tenant_id UNIQUE)
-- =============================================================================

ALTER TABLE invoice_templates ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE CASCADE;

UPDATE invoice_templates it
SET brand_id = b.id
FROM brands b
WHERE b.tenant_id = it.tenant_id AND b.is_default = true;

ALTER TABLE invoice_templates ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE invoice_templates DROP CONSTRAINT invoice_templates_tenant_id_key;
ALTER TABLE invoice_templates ADD CONSTRAINT invoice_templates_brand_id_key UNIQUE (brand_id);

-- =============================================================================
-- 4. Thread brand_id through the lead -> quote -> job -> invoice chain
-- =============================================================================

ALTER TABLE leads ADD COLUMN brand_id uuid REFERENCES brands(id);
UPDATE leads l SET brand_id = b.id FROM brands b WHERE b.tenant_id = l.tenant_id AND b.is_default = true;
ALTER TABLE leads ALTER COLUMN brand_id SET NOT NULL;
CREATE INDEX idx_leads_brand_id ON leads(brand_id);

ALTER TABLE quotes ADD COLUMN brand_id uuid REFERENCES brands(id);
-- Inherit from the lead where one exists; fall back to the tenant's default
-- brand for quotes with no lead (matches how lead_id is already nullable
-- on quotes today).
UPDATE quotes q SET brand_id = l.brand_id FROM leads l WHERE l.id = q.lead_id;
UPDATE quotes q SET brand_id = b.id FROM brands b WHERE q.brand_id IS NULL AND b.tenant_id = q.tenant_id AND b.is_default = true;
ALTER TABLE quotes ALTER COLUMN brand_id SET NOT NULL;
CREATE INDEX idx_quotes_brand_id ON quotes(brand_id);

ALTER TABLE jobs ADD COLUMN brand_id uuid REFERENCES brands(id);
-- Inherit from the quote where one exists (quote_id is nullable — manual
-- jobs have none); fall back to the tenant's default brand for the
-- pre-existing manual jobs this backfill can't retroactively attribute to a
-- specific brand.
UPDATE jobs j SET brand_id = q.brand_id FROM quotes q WHERE q.id = j.quote_id;
UPDATE jobs j SET brand_id = b.id FROM brands b WHERE j.brand_id IS NULL AND b.tenant_id = j.tenant_id AND b.is_default = true;
ALTER TABLE jobs ALTER COLUMN brand_id SET NOT NULL;
CREATE INDEX idx_jobs_brand_id ON jobs(brand_id);

-- Invoices: brand_id + the frozen brand_snapshot. brand_snapshot's keys
-- mirror the brands row's own real column names exactly (see
-- internal_create_invoice_snapshot below) so the same TS shape renders both
-- a live brands row (template preview) and a frozen snapshot (issued
-- invoice) with zero translation layer.
ALTER TABLE invoices ADD COLUMN brand_id uuid REFERENCES brands(id);
ALTER TABLE invoices ADD COLUMN brand_snapshot jsonb;

UPDATE invoices i SET brand_id = j.brand_id FROM jobs j WHERE j.id = i.job_id;
UPDATE invoices i SET brand_id = b.id FROM brands b WHERE i.brand_id IS NULL AND b.tenant_id = i.tenant_id AND b.is_default = true;

-- Best-effort backfill only, stated plainly: pre-existing invoices never
-- had a real snapshot captured at their actual issuance moment (the
-- concept didn't exist yet), so this fills brand_snapshot from the brand's
-- CURRENT values as of this migration, not a true historical snapshot. Every
-- invoice created from this migration forward gets a real one, captured
-- inside internal_create_invoice_snapshot at creation time.
UPDATE invoices i
SET brand_snapshot = jsonb_build_object(
  'name', b.name, 'logo_url', b.logo_url, 'email', b.email, 'phone', b.phone,
  'address_line_1', b.address_line_1, 'address_line_2', b.address_line_2,
  'address_city', b.address_city, 'address_county', b.address_county,
  'address_postcode', b.address_postcode, 'address_country', b.address_country,
  'vat_number', b.vat_number, 'bank_details', b.bank_details, 'terms_text', b.terms_text
)
FROM brands b
WHERE b.id = i.brand_id;

ALTER TABLE invoices ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN brand_snapshot SET NOT NULL;
CREATE INDEX idx_invoices_brand_id ON invoices(brand_id);

-- =============================================================================
-- 5. Mailboxes / email_threads — brand-aware inbox correspondence
-- =============================================================================
-- Nullable: a mailbox not yet assigned a brand falls back to the tenant's
-- default brand in application code, same fallback shape used everywhere
-- else in this migration. Not required to be set at connection time.

ALTER TABLE mailboxes ADD COLUMN brand_id uuid REFERENCES brands(id);
CREATE INDEX idx_mailboxes_brand_id ON mailboxes(brand_id);

-- Denormalized alongside mailbox_id, matching this codebase's existing
-- convention of duplicating tenant_id onto nearly every table for
-- query/RLS simplicity rather than requiring a join.
ALTER TABLE email_threads ADD COLUMN brand_id uuid REFERENCES brands(id);
UPDATE email_threads et SET brand_id = m.brand_id FROM mailboxes m WHERE m.id = et.mailbox_id;
CREATE INDEX idx_email_threads_brand_id ON email_threads(brand_id);

-- =============================================================================
-- 6. Web widget key: re-scope from tenants to brands
-- =============================================================================
-- widget_rate_limits.widget_key currently FK-references tenants
-- (public_widget_key). New brands generate their own fresh random key
-- (uniqueness enforced by idx_brands_public_widget_key above) that would
-- violate that old FK, so it must move to reference brands instead. The
-- default brand's key was already backfilled to equal the tenant's real
-- existing key in step 2 above — so this FK swap is a no-op for every
-- already-embedded snippet; only brand-new brands get brand-new keys.

ALTER TABLE widget_rate_limits DROP CONSTRAINT IF EXISTS widget_rate_limits_widget_key_fkey;
ALTER TABLE widget_rate_limits
  ADD CONSTRAINT widget_rate_limits_widget_key_fkey
  FOREIGN KEY (widget_key) REFERENCES brands(public_widget_key) ON DELETE CASCADE;

-- =============================================================================
-- 7. provision_tenant_defaults(): every new tenant gets a default brand too
-- =============================================================================

CREATE OR REPLACE FUNCTION public.provision_tenant_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
BEGIN
  -- Insert default tenant_settings
  INSERT INTO public.tenant_settings (tenant_id, primary_color, address_country)
  VALUES (NEW.id, '#1a56db', 'GB')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Insert default pricing_settings with minimum positive rates
  INSERT INTO public.pricing_settings (
    tenant_id,
    base_rate,
    per_mile_rate,
    per_cubic_foot_rate,
    labor_hourly_rate,
    labour_hours_per_cubicft
  )
  VALUES (NEW.id, 100, 1, 0.5, 25, 0.1)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Auto-provision 14-day trial subscription
  INSERT INTO public.tenant_subscriptions (tenant_id, status, current_period_end)
  VALUES (NEW.id, 'trialing', now() + interval '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Default brand, using this tenant's own real public_widget_key so the
  -- widget mechanism resolves identically whether callers look it up via
  -- tenants or brands.
  INSERT INTO public.brands (tenant_id, name, public_widget_key, is_default)
  VALUES (NEW.id, 'Default Brand', NEW.public_widget_key, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_brand_id;

  IF v_brand_id IS NULL THEN
    SELECT id INTO v_brand_id FROM public.brands WHERE tenant_id = NEW.id AND is_default = true;
  END IF;

  -- Insert default invoice_templates layout, now brand-owned
  INSERT INTO public.invoice_templates (tenant_id, brand_id, layout_blocks)
  VALUES (NEW.id, v_brand_id, '[
    {"type": "header", "config": {"showLogo": true, "alignment": "left"}},
    {"type": "line_items_table", "config": {"columns": ["description", "quantity", "unit_price", "amount"]}},
    {"type": "totals_summary", "config": {"showTaxBreakdown": true}},
    {"type": "terms_text", "config": {"show": true}},
    {"type": "footer", "config": {"showPageNumber": true, "customText": null}}
  ]'::jsonb)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 8. internal_create_invoice_snapshot(): brand-aware, real snapshot captured
--    inside the same transaction that creates the invoice.
-- =============================================================================
-- Deliberately reads the brands row itself (SECURITY DEFINER, same
-- transaction) rather than accepting a snapshot blob from application code
-- like deposit_schedule/balance_schedule do — brand data is already fully
-- in the database (unlike Stripe payment-intent info), so computing it here
-- is strictly more tamper-proof/authoritative than trusting a client-passed
-- JSON blob, and keeps the app-code call site to a single brand_id.

CREATE OR REPLACE FUNCTION internal_create_invoice_snapshot(
  p_tenant_id uuid,
  p_job_id uuid,
  p_contact_id uuid,
  p_brand_id uuid,
  p_invoice_subtotal numeric,
  p_invoice_tax_amount numeric,
  p_invoice_total numeric,
  p_line_items jsonb,
  p_deposit_schedule jsonb,
  p_balance_schedule jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_deposit_schedule_id uuid;
  v_item jsonb;
  v_brand_snapshot jsonb;
BEGIN
  SELECT jsonb_build_object(
    'name', name, 'logo_url', logo_url, 'email', email, 'phone', phone,
    'address_line_1', address_line_1, 'address_line_2', address_line_2,
    'address_city', address_city, 'address_county', address_county,
    'address_postcode', address_postcode, 'address_country', address_country,
    'vat_number', vat_number, 'bank_details', bank_details, 'terms_text', terms_text
  )
  INTO v_brand_snapshot
  FROM brands
  WHERE id = p_brand_id AND tenant_id = p_tenant_id;

  IF v_brand_snapshot IS NULL THEN
    RAISE EXCEPTION 'Brand not found for this tenant' USING ERRCODE = 'P0002';
  END IF;

  -- Create Invoice
  INSERT INTO invoices (
    tenant_id, job_id, contact_id, brand_id, brand_snapshot, status, subtotal, tax_amount, total, issued_at
  )
  VALUES (
    p_tenant_id, p_job_id, p_contact_id, p_brand_id, v_brand_snapshot, 'draft', p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, current_date
  )
  RETURNING id INTO v_invoice_id;

  -- Insert line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO invoice_line_items (
      tenant_id, invoice_id, description, quantity, unit_price, amount, sort_order
    )
    VALUES (
      p_tenant_id,
      v_invoice_id,
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'amount')::numeric,
      (v_item->>'sort_order')::int
    );
  END LOOP;

  -- Create deposit schedule if present
  IF p_deposit_schedule IS NOT NULL THEN
    INSERT INTO payment_schedules (
      tenant_id, invoice_id, description, amount, due_date, status
    )
    VALUES (
      p_tenant_id,
      v_invoice_id,
      p_deposit_schedule->>'description',
      (p_deposit_schedule->>'amount')::numeric,
      (p_deposit_schedule->>'due_date')::date,
      (p_deposit_schedule->>'status')::schedule_status
    )
    RETURNING id INTO v_deposit_schedule_id;

    IF p_deposit_schedule->>'stripe_payment_intent_id' IS NOT NULL THEN
      INSERT INTO payments (
        tenant_id, invoice_id, payment_schedule_id, amount, method, stripe_payment_intent_id, status, paid_at
      )
      VALUES (
        p_tenant_id,
        v_invoice_id,
        v_deposit_schedule_id,
        (p_deposit_schedule->>'amount')::numeric,
        'card',
        p_deposit_schedule->>'stripe_payment_intent_id',
        'succeeded',
        now()
      );
    END IF;
  END IF;

  -- Balance schedule
  IF p_balance_schedule IS NOT NULL THEN
    INSERT INTO payment_schedules (
      tenant_id, invoice_id, description, amount, due_date, status
    )
    VALUES (
      p_tenant_id,
      v_invoice_id,
      p_balance_schedule->>'description',
      (p_balance_schedule->>'amount')::numeric,
      (p_balance_schedule->>'due_date')::date,
      (p_balance_schedule->>'status')::schedule_status
    );
  END IF;

  RETURN v_invoice_id;
END;
$$;

-- =============================================================================
-- 9. accept_quote_transaction(): brand_id derived from the quote itself
--    (quotes.brand_id is NOT NULL as of this migration) — no new required
--    app-code param.
-- =============================================================================

CREATE OR REPLACE FUNCTION accept_quote_transaction(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_lead_id uuid,
  p_contact_id uuid,
  p_move_date date,
  p_origin_address_id uuid,
  p_destination_address_id uuid,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_invoice_subtotal numeric DEFAULT 0,
  p_invoice_tax_amount numeric DEFAULT 0,
  p_invoice_total numeric DEFAULT 0,
  p_line_items jsonb DEFAULT '[]'::jsonb,
  p_deposit_schedule jsonb DEFAULT NULL,
  p_balance_schedule jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
  v_invoice_id uuid;
  v_brand_id uuid;
  v_dep jsonb := p_deposit_schedule;
BEGIN
  SELECT brand_id INTO v_brand_id FROM quotes
  WHERE id = p_quote_id AND tenant_id = p_tenant_id AND status = 'sent'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in sent status' USING ERRCODE = 'P0002';
  END IF;

  UPDATE quotes
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id;

  INSERT INTO jobs (
    tenant_id, quote_id, contact_id, brand_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, p_quote_id, p_contact_id, v_brand_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
  )
  RETURNING id INTO v_job_id;

  IF p_lead_id IS NOT NULL THEN
    UPDATE leads
    SET stage = 'confirmed_booking', updated_at = now()
    WHERE id = p_lead_id AND tenant_id = p_tenant_id;
  END IF;

  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (p_tenant_id, 'quote.accepted', 'quoting', jsonb_build_object('quote_id', p_quote_id, 'job_id', v_job_id));

  IF p_stripe_payment_intent_id IS NOT NULL AND v_dep IS NOT NULL THEN
    v_dep := jsonb_set(v_dep, '{stripe_payment_intent_id}', to_jsonb(p_stripe_payment_intent_id));
  END IF;

  v_invoice_id := internal_create_invoice_snapshot(
    p_tenant_id, v_job_id, p_contact_id, v_brand_id, p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, p_line_items, v_dep, p_balance_schedule
  );

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;

-- =============================================================================
-- 10. create_manual_job_transaction(): brand_id is a new required param —
--     there's no quote/lead to inherit from for a manually-created job, so
--     the caller (manual job form) must supply it explicitly.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_manual_job_transaction(
  p_tenant_id uuid,
  p_contact_id uuid,
  p_brand_id uuid,
  p_move_date date,
  p_origin_address_id uuid,
  p_destination_address_id uuid,
  p_invoice_subtotal numeric,
  p_invoice_tax_amount numeric,
  p_invoice_total numeric,
  p_line_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
  v_invoice_id uuid;
  v_balance_schedule jsonb;
BEGIN
  INSERT INTO jobs (
    tenant_id, quote_id, contact_id, brand_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, NULL, p_contact_id, p_brand_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
  )
  RETURNING id INTO v_job_id;

  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (p_tenant_id, 'job.created_manually', 'jobs', jsonb_build_object('job_id', v_job_id));

  v_balance_schedule := jsonb_build_object(
    'description', 'Balance Due',
    'amount', p_invoice_total,
    'due_date', COALESCE(p_move_date, current_date),
    'status', 'pending'
  );

  v_invoice_id := internal_create_invoice_snapshot(
    p_tenant_id, v_job_id, p_contact_id, p_brand_id, p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, p_line_items, NULL, v_balance_schedule
  );

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;
