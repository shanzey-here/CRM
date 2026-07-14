-- =============================================================================
-- Phase 0 — Foundational Database Schema
-- Multi-Tenant Removals & Storage SaaS Platform
-- =============================================================================
-- This migration is idempotent-safe and ordered for a single top-to-bottom run.
-- It creates the complete Phase 1 core schema: extensions, enums, helpers,
-- tables, constraints, indexes, triggers, RLS enablement, and RLS policies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- exclusion constraints on tstzrange

-- ─────────────────────────────────────────────────────────────────────────────
-- B. ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────
-- PostgreSQL ENUMs: type-safe, self-documenting, domain-fixed values.
-- Extendable via ALTER TYPE ... ADD VALUE; values cannot be removed without
-- a full migration (acceptable trade-off for these stable domain sets).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE tenant_status AS ENUM (
  'trialing', 'active', 'past_due', 'suspended', 'cancelled'
);

CREATE TYPE tenant_role AS ENUM (
  'tenant_admin', 'dispatcher', 'crew', 'customer'
);

CREATE TYPE contact_type AS ENUM (
  'residential', 'commercial', 'property_manager'
);

CREATE TYPE lead_stage AS ENUM (
  'inquiry', 'survey_scheduled', 'quote_sent', 'follow_up',
  'confirmed_booking', 'completed', 'archived'
);

CREATE TYPE activity_type AS ENUM (
  'note', 'status_change', 'email', 'call', 'task', 'system'
);

CREATE TYPE priority_level AS ENUM (
  'low', 'medium', 'high'
);

CREATE TYPE task_status AS ENUM (
  'pending', 'in_progress', 'completed', 'cancelled'
);

CREATE TYPE quote_status AS ENUM (
  'draft', 'sent', 'accepted', 'declined', 'expired'
);

CREATE TYPE job_status AS ENUM (
  'scheduled', 'in_progress', 'completed', 'cancelled'
);

CREATE TYPE invoice_status AS ENUM (
  'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'
);

CREATE TYPE payment_method AS ENUM (
  'card', 'apple_pay', 'google_pay', 'bank_transfer'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'refunded'
);

CREATE TYPE schedule_status AS ENUM (
  'pending', 'paid', 'overdue'
);

CREATE TYPE assignment_role AS ENUM (
  'driver', 'porter', 'lead_crew', 'supervisor'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- C1. Resolve the current user's tenant from JWT app_metadata.
-- SECURITY DEFINER + STABLE: no side effects, reads JWT only.
-- Returns NULL for super-admins (is_super_admin = true, tenant_id absent).
-- Why JWT? Avoids DB lookup on every RLS check → no recursion, no perf hit.
-- app_metadata is server-writable only → tamper-proof from client side.
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
    ''
  )::uuid;
$$;

-- C2. Resolve the current user's tenant role from JWT app_metadata.
CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_role');
$$;

-- C3. Check if the current user is a platform super-admin.
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

-- C4. Generic updated_at trigger function.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- C5. Generate sequential invoice number per tenant (INV-00001 format).
-- Uses SELECT ... FOR UPDATE on tenant_invoice_sequences to prevent race
-- conditions under concurrent inserts. Called by BEFORE INSERT trigger.
-- Why DB-level? UK HMRC expects sequential numbering; app-layer risks gaps.
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next_number int;
BEGIN
  UPDATE public.tenant_invoice_sequences
  SET last_number = last_number + 1
  WHERE tenant_id = p_tenant_id
  RETURNING last_number INTO v_next_number;

  -- If no row exists yet, create one (first invoice for this tenant)
  IF v_next_number IS NULL THEN
    INSERT INTO public.tenant_invoice_sequences (tenant_id, last_number)
    VALUES (p_tenant_id, 1)
    ON CONFLICT (tenant_id) DO UPDATE SET last_number = public.tenant_invoice_sequences.last_number + 1
    RETURNING last_number INTO v_next_number;
  END IF;

  RETURN 'INV-' || lpad(v_next_number::text, 5, '0');
END;
$$;

-- C6. Trigger function to auto-set invoice_number on INSERT if not provided.
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_invoice_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. TABLES — FOUNDATION
-- ─────────────────────────────────────────────────────────────────────────────

-- D1. tenants — the root entity. No tenant_id on itself.
-- One row per removals company using the platform.
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      tenant_status NOT NULL DEFAULT 'trialing',
  base_currency text NOT NULL DEFAULT 'GBP',
  settings    jsonb DEFAULT '{}',
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

-- D2. users — links to Supabase auth.users.
-- tenant_id is nullable: NULL for platform super-admins.
-- UNIQUE(id, tenant_id) enables composite FKs from child tables.
CREATE TABLE users (
  id          uuid PRIMARY KEY,  -- = auth.users.id, set on signup
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE,
  role        tenant_role,       -- NULL for super-admins
  full_name   text NOT NULL,
  email       text NOT NULL,
  phone       text,
  avatar_url  text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,

  CONSTRAINT users_tenant_unique UNIQUE (id, tenant_id)
);

-- D3. tenant_settings — one row per tenant, branding & business config.
CREATE TABLE tenant_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  company_legal_name  text,
  logo_url            text,
  primary_color       text DEFAULT '#1a56db',
  address_line_1      text,
  address_line_2      text,
  address_city        text,
  address_county      text,
  address_postcode    text,
  address_country     text DEFAULT 'GB',
  vat_number          text,
  phone               text,
  email               text,
  website             text,
  terms_template      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz
);

-- D4. tenant_modules — per-tenant module/feature-flag registry.
-- New modules register themselves here; toggleable without redeploy.
CREATE TABLE tenant_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key  text NOT NULL,
  enabled     boolean NOT NULL DEFAULT false,
  settings    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,

  CONSTRAINT tenant_modules_unique UNIQUE (tenant_id, module_key)
);

-- D5. domain_events — outbox/event bus for cross-module decoupling.
-- Modules emit events here; consumers poll by event_type + processed_at.
CREATE TABLE domain_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type    text NOT NULL,      -- e.g. 'lead.stage_changed', 'quote.accepted'
  source_module text NOT NULL,      -- e.g. 'crm', 'quoting', 'jobs'
  payload       jsonb NOT NULL DEFAULT '{}',
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz         -- NULL = unprocessed
);

-- D6. tenant_invoice_sequences — per-tenant sequential invoice numbering.
-- One row per tenant, atomically incremented by generate_invoice_number().
CREATE TABLE tenant_invoice_sequences (
  tenant_id    uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  last_number  int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz
);

-- D7. addresses — normalized, shared address table.
-- Referenced by leads (origin/destination), jobs, etc.
CREATE TABLE addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_1        text NOT NULL,
  line_2        text,
  city          text NOT NULL,
  county        text,
  postcode      text NOT NULL,
  country       text NOT NULL DEFAULT 'GB',
  lat           numeric,
  lng           numeric,
  access_notes  text,
  floor_level   int,
  has_lift      boolean DEFAULT false,
  parking_notes text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,

  CONSTRAINT addresses_tenant_unique UNIQUE (id, tenant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. TABLES — CRM MODULE
-- ─────────────────────────────────────────────────────────────────────────────

-- E1. contacts — the customer/company record.
-- user_id links to users when this contact has a customer-portal login.
-- This is the bridge that makes customer-scoped RLS policies concrete:
-- auth.uid() → contacts.user_id → contact_id → leads/quotes/invoices.
CREATE TABLE contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type          contact_type NOT NULL DEFAULT 'residential',
  user_id       uuid,  -- nullable: set when customer has a portal account
  first_name    text NOT NULL,
  last_name     text,
  company_name  text,
  email         text,
  phone         text,
  alt_phone     text,
  notes         text,
  is_archived   boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES users(id),
  updated_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,

  CONSTRAINT contacts_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT contacts_user_fk FOREIGN KEY (user_id, tenant_id)
    REFERENCES users(id, tenant_id)
);

-- E2. leads — an enquiry/opportunity tied to a contact.
-- Carries the pipeline stage and links to origin/destination addresses.
CREATE TABLE leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id            uuid NOT NULL,
  stage                 lead_stage NOT NULL DEFAULT 'inquiry',
  source                text,                  -- e.g. 'website', 'compare_my_move', 'referral'
  preferred_move_date   date,
  origin_address_id     uuid,
  destination_address_id uuid,
  estimated_volume      numeric,               -- cubic feet
  assigned_to           uuid,                  -- user (dispatcher/crew)
  notes                 text,
  is_archived           boolean NOT NULL DEFAULT false,
  created_by            uuid REFERENCES users(id),
  updated_by            uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,

  CONSTRAINT leads_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT leads_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts(id, tenant_id),
  CONSTRAINT leads_origin_address_fk FOREIGN KEY (origin_address_id, tenant_id)
    REFERENCES addresses(id, tenant_id),
  CONSTRAINT leads_destination_address_fk FOREIGN KEY (destination_address_id, tenant_id)
    REFERENCES addresses(id, tenant_id),
  CONSTRAINT leads_assigned_to_fk FOREIGN KEY (assigned_to, tenant_id)
    REFERENCES users(id, tenant_id)
);

-- E3. activities — centralized chronological timeline per contact/lead.
-- At least one of contact_id or lead_id must be set.
CREATE TABLE activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id    uuid,
  lead_id       uuid,
  activity_type activity_type NOT NULL,
  title         text NOT NULL,
  description   text,
  metadata      jsonb DEFAULT '{}',
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activities_has_parent CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL),
  CONSTRAINT activities_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts(id, tenant_id),
  CONSTRAINT activities_lead_fk FOREIGN KEY (lead_id, tenant_id)
    REFERENCES leads(id, tenant_id)
);

-- E4. tasks — team to-dos, optionally linked to contact/lead.
CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  assigned_to   uuid,
  due_date      date,
  priority      priority_level NOT NULL DEFAULT 'medium',
  status        task_status NOT NULL DEFAULT 'pending',
  contact_id    uuid,
  lead_id       uuid,
  created_by    uuid REFERENCES users(id),
  updated_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,

  CONSTRAINT tasks_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts(id, tenant_id),
  CONSTRAINT tasks_lead_fk FOREIGN KEY (lead_id, tenant_id)
    REFERENCES leads(id, tenant_id),
  CONSTRAINT tasks_assigned_to_fk FOREIGN KEY (assigned_to, tenant_id)
    REFERENCES users(id, tenant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. TABLES — QUOTING MODULE
-- ─────────────────────────────────────────────────────────────────────────────

-- F1. inventory_items — per-tenant catalog of movable items.
-- Each item mapped to a room with a default cubic volume for the calculator.
CREATE TABLE inventory_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           text NOT NULL,
  room           text,                   -- e.g. 'bedroom', 'kitchen', 'garage'
  default_volume numeric NOT NULL DEFAULT 0,  -- cubic feet
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz,

  CONSTRAINT inventory_items_tenant_unique UNIQUE (id, tenant_id)
);

-- F2. pricing_settings — per-tenant rate rules.
-- One row per tenant. Surcharges stored as JSONB for MVP flexibility:
-- [{ "key": "stairs", "label": "Stairs", "amount": 50.00, "type": "fixed" }, ...]
CREATE TABLE pricing_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  base_rate             numeric(12,2) NOT NULL DEFAULT 0,
  per_mile_rate         numeric(12,2) NOT NULL DEFAULT 0,
  per_cubic_foot_rate   numeric(12,2) NOT NULL DEFAULT 0,
  labor_hourly_rate     numeric(12,2) NOT NULL DEFAULT 0,
  surcharges            jsonb DEFAULT '[]',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz
);

-- F3. quotes — a proposal tied to a lead/contact.
CREATE TABLE quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id               uuid,
  contact_id            uuid NOT NULL,
  status                quote_status NOT NULL DEFAULT 'draft',
  total_volume          numeric,               -- cubic feet
  travel_distance_miles numeric,
  travel_time_minutes   int,
  subtotal              numeric(12,2) NOT NULL DEFAULT 0,
  surcharge_total       numeric(12,2) NOT NULL DEFAULT 0,
  total_price           numeric(12,2) NOT NULL DEFAULT 0,
  deposit_amount        numeric(12,2) DEFAULT 0,
  terms                 text,
  valid_until           date,
  accepted_at           timestamptz,
  signature_data        text,                  -- base64 encoded signature image
  signature_name        text,                  -- printed name for signature
  created_by            uuid REFERENCES users(id),
  updated_by            uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,

  CONSTRAINT quotes_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT quotes_lead_fk FOREIGN KEY (lead_id, tenant_id)
    REFERENCES leads(id, tenant_id),
  CONSTRAINT quotes_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts(id, tenant_id)
);

-- F4. quote_inventory — selected items behind a quote's volume calculation.
CREATE TABLE quote_inventory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id          uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  room              text,
  quantity          int NOT NULL DEFAULT 1,
  volume            numeric NOT NULL DEFAULT 0,  -- computed: quantity × item default_volume (overridable)
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_inventory_quote_fk FOREIGN KEY (quote_id, tenant_id)
    REFERENCES quotes(id, tenant_id),
  CONSTRAINT quote_inventory_item_fk FOREIGN KEY (inventory_item_id, tenant_id)
    REFERENCES inventory_items(id, tenant_id)
);

-- F5. quote_line_items — priced lines on the quote.
CREATE TABLE quote_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id    uuid NOT NULL,
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_line_items_quote_fk FOREIGN KEY (quote_id, tenant_id)
    REFERENCES quotes(id, tenant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- G. TABLES — JOBS & SCHEDULING MODULE
-- ─────────────────────────────────────────────────────────────────────────────

-- G1. jobs — created from an accepted quote.
CREATE TABLE jobs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id               uuid,
  contact_id             uuid NOT NULL,
  status                 job_status NOT NULL DEFAULT 'scheduled',
  move_date              date,
  origin_address_id      uuid,
  destination_address_id uuid,
  customer_notes         text,
  internal_notes         text,
  created_by             uuid REFERENCES users(id),
  updated_by             uuid REFERENCES users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz,

  CONSTRAINT jobs_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT jobs_quote_fk FOREIGN KEY (quote_id, tenant_id)
    REFERENCES quotes(id, tenant_id),
  CONSTRAINT jobs_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts(id, tenant_id),
  CONSTRAINT jobs_origin_address_fk FOREIGN KEY (origin_address_id, tenant_id)
    REFERENCES addresses(id, tenant_id),
  CONSTRAINT jobs_destination_address_fk FOREIGN KEY (destination_address_id, tenant_id)
    REFERENCES addresses(id, tenant_id)
);

-- G2. vehicles — schedulable fleet resource.
CREATE TABLE vehicles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           text NOT NULL,
  registration   text,
  type           text,           -- e.g. 'Luton Van', '7.5t', 'Container'
  capacity_cubic numeric,        -- cubic feet
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz,

  CONSTRAINT vehicles_tenant_unique UNIQUE (id, tenant_id)
);

-- G3. job_crew_assignments — allocates crew members to a job.
-- Composite FK ensures user belongs to same tenant as job.
-- Exclusion constraint prevents double-booking same crew member.
CREATE TABLE job_crew_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL,
  user_id         uuid NOT NULL,
  assignment_role assignment_role NOT NULL DEFAULT 'porter',
  scheduled_start timestamptz NOT NULL,
  scheduled_end   timestamptz NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,

  CONSTRAINT job_crew_job_fk FOREIGN KEY (job_id, tenant_id)
    REFERENCES jobs(id, tenant_id),
  CONSTRAINT job_crew_user_fk FOREIGN KEY (user_id, tenant_id)
    REFERENCES users(id, tenant_id),
  CONSTRAINT job_crew_time_valid CHECK (scheduled_end > scheduled_start)
);

-- G4. job_vehicle_assignments — allocates vehicles to a job.
-- Composite FK ensures vehicle belongs to same tenant as job.
-- Exclusion constraint prevents double-booking same vehicle.
CREATE TABLE job_vehicle_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL,
  vehicle_id      uuid NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end   timestamptz NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,

  CONSTRAINT job_vehicle_job_fk FOREIGN KEY (job_id, tenant_id)
    REFERENCES jobs(id, tenant_id),
  CONSTRAINT job_vehicle_vehicle_fk FOREIGN KEY (vehicle_id, tenant_id)
    REFERENCES vehicles(id, tenant_id),
  CONSTRAINT job_vehicle_time_valid CHECK (scheduled_end > scheduled_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- H. TABLES — FINANCIALS MODULE
-- ─────────────────────────────────────────────────────────────────────────────

-- H1. invoices — tied to a job/contact.
-- invoice_number auto-generated by trigger (INV-00001 format per tenant).
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id          uuid,
  contact_id      uuid NOT NULL,
  invoice_number  text,             -- auto-set by trigger if NULL
  status          invoice_status NOT NULL DEFAULT 'draft',
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  issued_at       date,
  due_date        date,
  paid_at         timestamptz,
  notes           text,
  created_by      uuid REFERENCES users(id),
  updated_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,

  CONSTRAINT invoices_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT invoices_number_unique UNIQUE (tenant_id, invoice_number),
  CONSTRAINT invoices_job_fk FOREIGN KEY (job_id, tenant_id)
    REFERENCES jobs(id, tenant_id),
  CONSTRAINT invoices_contact_fk FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts(id, tenant_id)
);

-- H2. invoice_line_items — line items on an invoice.
CREATE TABLE invoice_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id  uuid NOT NULL,
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoice_line_items_invoice_fk FOREIGN KEY (invoice_id, tenant_id)
    REFERENCES invoices(id, tenant_id)
);

-- H3. payment_schedules — split billing milestones.
-- e.g. deposit on booking, balance 48h before move day.
CREATE TABLE payment_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id  uuid NOT NULL,
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  due_date    date NOT NULL,
  status      schedule_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,

  CONSTRAINT payment_schedules_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT payment_schedules_invoice_fk FOREIGN KEY (invoice_id, tenant_id)
    REFERENCES invoices(id, tenant_id)
);

-- H4. payments — actual payment records against an invoice/schedule.
-- No card data stored; Stripe handles card processing.
CREATE TABLE payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id               uuid NOT NULL,
  payment_schedule_id      uuid,
  amount                   numeric(12,2) NOT NULL,
  method                   payment_method NOT NULL,
  stripe_payment_intent_id text,
  status                   payment_status NOT NULL DEFAULT 'pending',
  paid_at                  timestamptz,
  created_by               uuid REFERENCES users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payments_invoice_fk FOREIGN KEY (invoice_id, tenant_id)
    REFERENCES invoices(id, tenant_id),
  CONSTRAINT payments_schedule_fk FOREIGN KEY (payment_schedule_id, tenant_id)
    REFERENCES payment_schedules(id, tenant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- I. EXCLUSION CONSTRAINTS (double-booking prevention)
-- ─────────────────────────────────────────────────────────────────────────────
-- Uses btree_gist to prevent the same crew member or vehicle from being
-- assigned to overlapping time ranges within the same tenant.

ALTER TABLE job_crew_assignments
  ADD CONSTRAINT no_crew_double_booking
  EXCLUDE USING gist (
    tenant_id WITH =,
    user_id WITH =,
    tstzrange(scheduled_start, scheduled_end) WITH &&
  );

ALTER TABLE job_vehicle_assignments
  ADD CONSTRAINT no_vehicle_double_booking
  EXCLUDE USING gist (
    tenant_id WITH =,
    vehicle_id WITH =,
    tstzrange(scheduled_start, scheduled_end) WITH &&
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- J. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
-- All tenant-scoped indexes lead with tenant_id for efficient RLS filtering.
-- Every FK column gets an index.

-- Foundation
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_tenant_settings_tenant ON tenant_settings(tenant_id);
CREATE INDEX idx_tenant_modules_tenant ON tenant_modules(tenant_id);
CREATE INDEX idx_domain_events_tenant_type_processed ON domain_events(tenant_id, event_type, processed_at);
CREATE INDEX idx_addresses_tenant ON addresses(tenant_id);

-- CRM
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_tenant_user ON contacts(tenant_id, user_id);
CREATE INDEX idx_contacts_tenant_archived ON contacts(tenant_id, is_archived);
CREATE INDEX idx_leads_tenant_contact ON leads(tenant_id, contact_id);
CREATE INDEX idx_leads_tenant_stage ON leads(tenant_id, stage);
CREATE INDEX idx_leads_tenant_assigned ON leads(tenant_id, assigned_to);
CREATE INDEX idx_activities_tenant_contact ON activities(tenant_id, contact_id);
CREATE INDEX idx_activities_tenant_lead ON activities(tenant_id, lead_id);
CREATE INDEX idx_tasks_tenant_assigned ON tasks(tenant_id, assigned_to);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_tenant_contact ON tasks(tenant_id, contact_id);
CREATE INDEX idx_tasks_tenant_lead ON tasks(tenant_id, lead_id);

-- Quoting
CREATE INDEX idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX idx_quotes_tenant_contact ON quotes(tenant_id, contact_id);
CREATE INDEX idx_quotes_tenant_lead ON quotes(tenant_id, lead_id);
CREATE INDEX idx_quotes_tenant_status ON quotes(tenant_id, status);
CREATE INDEX idx_quote_inventory_tenant_quote ON quote_inventory(tenant_id, quote_id);
CREATE INDEX idx_quote_line_items_tenant_quote ON quote_line_items(tenant_id, quote_id);

-- Jobs & Scheduling
CREATE INDEX idx_jobs_tenant_contact ON jobs(tenant_id, contact_id);
CREATE INDEX idx_jobs_tenant_quote ON jobs(tenant_id, quote_id);
CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_tenant_move_date ON jobs(tenant_id, move_date);
CREATE INDEX idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX idx_job_crew_tenant_job ON job_crew_assignments(tenant_id, job_id);
CREATE INDEX idx_job_crew_tenant_user ON job_crew_assignments(tenant_id, user_id);
CREATE INDEX idx_job_vehicle_tenant_job ON job_vehicle_assignments(tenant_id, job_id);
CREATE INDEX idx_job_vehicle_tenant_vehicle ON job_vehicle_assignments(tenant_id, vehicle_id);

-- Financials
CREATE INDEX idx_invoices_tenant_contact ON invoices(tenant_id, contact_id);
CREATE INDEX idx_invoices_tenant_job ON invoices(tenant_id, job_id);
CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoice_line_items_tenant_invoice ON invoice_line_items(tenant_id, invoice_id);
CREATE INDEX idx_payment_schedules_tenant_invoice ON payment_schedules(tenant_id, invoice_id);
CREATE INDEX idx_payments_tenant_invoice ON payments(tenant_id, invoice_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- K. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- K1. updated_at triggers — every table with an updated_at column
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_invoice_sequences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pricing_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_crew_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_vehicle_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- K2. Invoice number auto-generation trigger
CREATE TRIGGER set_invoice_number BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

-- ─────────────────────────────────────────────────────────────────────────────
-- L. ROW-LEVEL SECURITY — ENABLEMENT
-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE + FORCE: even table owners (postgres role) are subject to RLS
-- when queries come through PostgREST. service_role bypasses by design.
-- Default posture = deny. Policies grant access explicitly.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules FORCE ROW LEVEL SECURITY;

ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events FORCE ROW LEVEL SECURITY;

ALTER TABLE tenant_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoice_sequences FORCE ROW LEVEL SECURITY;

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses FORCE ROW LEVEL SECURITY;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;

ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

ALTER TABLE quote_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_inventory FORCE ROW LEVEL SECURITY;

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items FORCE ROW LEVEL SECURITY;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;

ALTER TABLE job_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_crew_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE job_vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_vehicle_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules FORCE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- M. ROW-LEVEL SECURITY — POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
-- Structure per table:
--   1. Super-admin bypass (FOR ALL, explicit policy)
--   2. tenant_admin / dispatcher (full CRUD within tenant)
--   3. crew (limited read, job-based)
--   4. customer (own records via contacts.user_id chain)
--
-- Default posture: deny. Each USING/WITH CHECK is additive.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================
-- M1. tenants
-- =============================
CREATE POLICY super_admin_all ON tenants FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY tenant_member_select ON tenants FOR SELECT
  USING (id = auth.current_tenant_id());

-- =============================
-- M2. users
-- =============================
CREATE POLICY super_admin_all ON users FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

-- tenant_admin / dispatcher: full CRUD within tenant
CREATE POLICY admin_dispatcher_select ON users FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );
CREATE POLICY admin_dispatcher_insert ON users FOR INSERT
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );
CREATE POLICY admin_dispatcher_update ON users FOR UPDATE
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );
CREATE POLICY admin_dispatcher_delete ON users FOR DELETE
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read all users in own tenant (for team context)
CREATE POLICY crew_select ON users FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
  );

-- customer: read own user record only
CREATE POLICY customer_select ON users FOR SELECT
  USING (
    id = auth.uid()
    AND auth.current_user_role() = 'customer'
  );

-- =============================
-- M3. tenant_settings
-- =============================
CREATE POLICY super_admin_all ON tenant_settings FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON tenant_settings FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

CREATE POLICY crew_select ON tenant_settings FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
  );

-- =============================
-- M4. tenant_modules
-- =============================
CREATE POLICY super_admin_all ON tenant_modules FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_select ON tenant_modules FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- =============================
-- M5. domain_events
-- =============================
CREATE POLICY super_admin_all ON domain_events FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_select ON domain_events FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );
CREATE POLICY admin_dispatcher_insert ON domain_events FOR INSERT
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- =============================
-- M6. tenant_invoice_sequences
-- (internal system table — no direct user access, managed by trigger)
-- =============================
CREATE POLICY super_admin_all ON tenant_invoice_sequences FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

-- =============================
-- M7. addresses
-- =============================
CREATE POLICY super_admin_all ON addresses FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON addresses FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

CREATE POLICY crew_select ON addresses FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
  );

-- customer: read addresses linked to their leads
CREATE POLICY customer_select ON addresses FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND id IN (
      SELECT l.origin_address_id FROM leads l
      JOIN contacts c ON c.id = l.contact_id AND c.tenant_id = l.tenant_id
      WHERE c.user_id = auth.uid() AND c.tenant_id = auth.current_tenant_id()
      UNION
      SELECT l.destination_address_id FROM leads l
      JOIN contacts c ON c.id = l.contact_id AND c.tenant_id = l.tenant_id
      WHERE c.user_id = auth.uid() AND c.tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M8. contacts
-- =============================
CREATE POLICY super_admin_all ON contacts FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON contacts FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read contacts that have leads assigned to them
CREATE POLICY crew_select ON contacts FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND id IN (
      SELECT contact_id FROM leads
      WHERE assigned_to = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- customer: read own contact record (contacts.user_id = auth.uid())
CREATE POLICY customer_select ON contacts FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND user_id = auth.uid()
  );

-- =============================
-- M9. leads
-- =============================
CREATE POLICY super_admin_all ON leads FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON leads FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read leads assigned to them
CREATE POLICY crew_select ON leads FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND assigned_to = auth.uid()
  );

-- customer: read leads on their own contact record
CREATE POLICY customer_select ON leads FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M10. activities
-- =============================
CREATE POLICY super_admin_all ON activities FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON activities FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read activities on leads assigned to them
CREATE POLICY crew_select ON activities FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND (
      lead_id IN (
        SELECT id FROM leads
        WHERE assigned_to = auth.uid()
          AND tenant_id = auth.current_tenant_id()
      )
      OR contact_id IN (
        SELECT contact_id FROM leads
        WHERE assigned_to = auth.uid()
          AND tenant_id = auth.current_tenant_id()
      )
    )
  );

-- customer: read activities on their own contact
CREATE POLICY customer_select ON activities FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M11. tasks
-- =============================
CREATE POLICY super_admin_all ON tasks FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON tasks FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read tasks assigned to them
CREATE POLICY crew_select ON tasks FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND assigned_to = auth.uid()
  );

-- crew: update tasks assigned to them (e.g. mark complete)
CREATE POLICY crew_update ON tasks FOR UPDATE
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
    AND assigned_to = auth.uid()
  );

-- =============================
-- M12. inventory_items
-- =============================
CREATE POLICY super_admin_all ON inventory_items FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON inventory_items FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

CREATE POLICY crew_select ON inventory_items FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
  );

-- =============================
-- M13. pricing_settings
-- =============================
CREATE POLICY super_admin_all ON pricing_settings FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON pricing_settings FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- =============================
-- M14. quotes
-- =============================
CREATE POLICY super_admin_all ON quotes FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON quotes FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read quotes on leads assigned to them
CREATE POLICY crew_select ON quotes FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND lead_id IN (
      SELECT id FROM leads
      WHERE assigned_to = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- customer: read quotes on their own contact
CREATE POLICY customer_select ON quotes FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M15. quote_inventory
-- =============================
CREATE POLICY super_admin_all ON quote_inventory FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON quote_inventory FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read via quote (quotes they can see)
CREATE POLICY crew_select ON quote_inventory FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND quote_id IN (
      SELECT q.id FROM quotes q
      JOIN leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
      WHERE l.assigned_to = auth.uid()
        AND q.tenant_id = auth.current_tenant_id()
    )
  );

-- customer: read via quote (quotes on their contact)
CREATE POLICY customer_select ON quote_inventory FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND quote_id IN (
      SELECT q.id FROM quotes q
      JOIN contacts c ON c.id = q.contact_id AND c.tenant_id = q.tenant_id
      WHERE c.user_id = auth.uid()
        AND q.tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M16. quote_line_items
-- =============================
CREATE POLICY super_admin_all ON quote_line_items FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON quote_line_items FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

CREATE POLICY crew_select ON quote_line_items FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND quote_id IN (
      SELECT q.id FROM quotes q
      JOIN leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
      WHERE l.assigned_to = auth.uid()
        AND q.tenant_id = auth.current_tenant_id()
    )
  );

CREATE POLICY customer_select ON quote_line_items FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND quote_id IN (
      SELECT q.id FROM quotes q
      JOIN contacts c ON c.id = q.contact_id AND c.tenant_id = q.tenant_id
      WHERE c.user_id = auth.uid()
        AND q.tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M17. jobs
-- =============================
CREATE POLICY super_admin_all ON jobs FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON jobs FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read jobs where they have an assignment
CREATE POLICY crew_select ON jobs FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND id IN (
      SELECT job_id FROM job_crew_assignments
      WHERE user_id = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- customer: read jobs on their own contact
CREATE POLICY customer_select ON jobs FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M18. vehicles
-- =============================
CREATE POLICY super_admin_all ON vehicles FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON vehicles FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

CREATE POLICY crew_select ON vehicles FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
  );

-- =============================
-- M19. job_crew_assignments
-- =============================
CREATE POLICY super_admin_all ON job_crew_assignments FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON job_crew_assignments FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read own assignments only
CREATE POLICY crew_select ON job_crew_assignments FOR SELECT
  USING (
    auth.current_user_role() = 'crew'
    AND tenant_id = auth.current_tenant_id()
    AND user_id = auth.uid()
  );

-- =============================
-- M20. job_vehicle_assignments
-- =============================
CREATE POLICY super_admin_all ON job_vehicle_assignments FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON job_vehicle_assignments FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- crew: read all vehicle assignments in tenant (for scheduling awareness)
CREATE POLICY crew_select ON job_vehicle_assignments FOR SELECT
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() = 'crew'
  );

-- =============================
-- M21. invoices
-- =============================
CREATE POLICY super_admin_all ON invoices FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON invoices FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- customer: read invoices on their own contact
CREATE POLICY customer_select ON invoices FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND contact_id IN (
      SELECT id FROM contacts
      WHERE user_id = auth.uid()
        AND tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M22. invoice_line_items
-- =============================
CREATE POLICY super_admin_all ON invoice_line_items FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON invoice_line_items FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- customer: read line items on their own invoices
CREATE POLICY customer_select ON invoice_line_items FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN contacts c ON c.id = i.contact_id AND c.tenant_id = i.tenant_id
      WHERE c.user_id = auth.uid()
        AND i.tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M23. payment_schedules
-- =============================
CREATE POLICY super_admin_all ON payment_schedules FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON payment_schedules FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- customer: read schedules on their own invoices
CREATE POLICY customer_select ON payment_schedules FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN contacts c ON c.id = i.contact_id AND c.tenant_id = i.tenant_id
      WHERE c.user_id = auth.uid()
        AND i.tenant_id = auth.current_tenant_id()
    )
  );

-- =============================
-- M24. payments
-- =============================
CREATE POLICY super_admin_all ON payments FOR ALL
  USING (auth.is_super_admin() = true)
  WITH CHECK (auth.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON payments FOR ALL
  USING (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = auth.current_tenant_id()
    AND auth.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- customer: read payments on their own invoices
CREATE POLICY customer_select ON payments FOR SELECT
  USING (
    auth.current_user_role() = 'customer'
    AND tenant_id = auth.current_tenant_id()
    AND invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN contacts c ON c.id = i.contact_id AND c.tenant_id = i.tenant_id
      WHERE c.user_id = auth.uid()
        AND i.tenant_id = auth.current_tenant_id()
    )
  );

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
