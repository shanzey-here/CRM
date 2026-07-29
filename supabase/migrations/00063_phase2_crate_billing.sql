-- 00063_phase2_crate_billing.sql
-- Automatic overdue/lost crate charging. Real money, no human-in-the-loop
-- review step before a charge happens — held to the same idempotency rigor
-- as invoicing-db/quoting-acceptance.

-- ============================================================================
-- Card-on-file (minimal extension to the existing deposit checkout, so the
-- unattended sweep below has a saved payment method to actually charge)
-- ============================================================================
ALTER TABLE contacts ADD COLUMN stripe_customer_id text;
ALTER TABLE contacts ADD COLUMN default_payment_method_id text;

-- ============================================================================
-- Configurable rates — same table/convention as every other pricing_settings
-- rate (base_rate, per_cubic_foot_rate, etc.). DEFAULT 0, not validated
-- positive at the DB level (see Zod schema for the "0 means not configured,
-- never charge an invented price" enforcement) — a tenant who hasn't set a
-- rate yet must never have crates silently charged.
-- ============================================================================
ALTER TABLE pricing_settings ADD COLUMN crate_overdue_rate_per_day numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pricing_settings ADD COLUMN crate_lost_fee numeric(12,2) NOT NULL DEFAULT 0;

-- ============================================================================
-- crate_charges — the idempotency ledger
-- ============================================================================
CREATE TYPE crate_charge_type AS ENUM ('overdue_fee', 'lost_fee');

-- 'requires_action' is deliberately distinct from 'failed': Stripe's
-- authentication_required error (SCA/3D Secure) means the customer must
-- actively complete a verification step — real and common for UK/EU cards,
-- not an edge case — and will NEVER resolve by the sweep blindly retrying,
-- unlike a genuine decline (insufficient funds, expired card), which might
-- succeed on a later attempt. Different remediation paths, different status.
CREATE TYPE crate_charge_status AS ENUM ('pending', 'charged', 'failed', 'requires_action');

CREATE TABLE crate_charges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crate_id    uuid NOT NULL,
  charge_type crate_charge_type NOT NULL,
  period_start date NOT NULL,
  amount      numeric(12,2) NOT NULL,
  invoice_id  uuid,
  stripe_payment_intent_id text,
  status      crate_charge_status NOT NULL DEFAULT 'pending',
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,

  CONSTRAINT crate_charges_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT crate_charges_crate_fk FOREIGN KEY (crate_id, tenant_id) REFERENCES crates(id, tenant_id),
  CONSTRAINT crate_charges_invoice_fk FOREIGN KEY (invoice_id, tenant_id) REFERENCES invoices(id, tenant_id)
);

CREATE INDEX idx_crate_charges_tenant ON crate_charges(tenant_id);
CREATE INDEX idx_crate_charges_crate ON crate_charges(crate_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crate_charges FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Overdue: at most one non-terminal-blocking charge per crate per calendar
-- day. 'failed' is excluded (retryable next sweep — a decline might succeed
-- later); 'requires_action' is NOT excluded (an SCA block won't resolve by
-- same-day retry, so it correctly still blocks a duplicate attempt for that
-- exact day — tomorrow's period_start is a new day and gets its own row).
CREATE UNIQUE INDEX crate_charges_overdue_period_unique ON crate_charges (tenant_id, crate_id, period_start)
  WHERE charge_type = 'overdue_fee' AND status <> 'failed';

-- Lost fee: at most one non-failed charge EVER, regardless of when
-- attempted — a genuinely different guarantee than "once per period", not
-- the same mechanism reused with different numbers.
CREATE UNIQUE INDEX crate_charges_lost_fee_once ON crate_charges (tenant_id, crate_id)
  WHERE charge_type = 'lost_fee' AND status <> 'failed';

ALTER TABLE crate_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE crate_charges FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON crate_charges
  FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON crate_charges
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

-- ============================================================================
-- Idempotency gate + atomic invoice creation.
-- Mirrors accept_quote_transaction's "atomic multi-table write via RPC"
-- style, and stripe_events' explicit philosophy (00038): the INSERT into
-- crate_charges is the FIRST statement — a unique_violation there means
-- this period/crate was already charged (or is mid-flight from a
-- concurrent sweep run), so we return a safe "already handled" signal
-- WITHOUT ever reaching the point where a caller would attempt a Stripe
-- call. This closes the check-then-charge race a separate SELECT would
-- leave open.
-- ============================================================================
CREATE FUNCTION create_crate_charge_invoice(
  p_tenant_id uuid,
  p_crate_id uuid,
  p_contact_id uuid,
  p_charge_type crate_charge_type,
  p_period_start date,
  p_amount numeric,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_charge_id uuid;
  v_invoice_id uuid;
BEGIN
  BEGIN
    INSERT INTO crate_charges (tenant_id, crate_id, charge_type, period_start, amount)
    VALUES (p_tenant_id, p_crate_id, p_charge_type, p_period_start, p_amount)
    RETURNING id INTO v_charge_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('already_charged', true);
  END;

  -- job_id always NULL — a crate-charge invoice is never the move's own
  -- invoice (invoices_one_per_job would otherwise be a real collision risk,
  -- and a crate rental charge is conceptually independent of the move).
  INSERT INTO invoices (tenant_id, contact_id, job_id, status, subtotal, total, issued_at, due_date)
  VALUES (p_tenant_id, p_contact_id, NULL, 'sent', p_amount, p_amount, current_date, current_date)
  RETURNING id INTO v_invoice_id;

  INSERT INTO invoice_line_items (tenant_id, invoice_id, description, quantity, unit_price, amount)
  VALUES (p_tenant_id, v_invoice_id, p_description, 1, p_amount, p_amount);

  UPDATE crate_charges SET invoice_id = v_invoice_id WHERE id = v_charge_id;

  RETURN jsonb_build_object('already_charged', false, 'crate_charge_id', v_charge_id, 'invoice_id', v_invoice_id);
END;
$$;

-- ============================================================================
-- Webhook-confirmed completion — mirrors record_invoice_payment's FOR
-- UPDATE idempotency guard exactly (00023_phase1_invoice_payment.sql).
-- ============================================================================
CREATE FUNCTION record_crate_charge_payment(
  p_tenant_id uuid,
  p_crate_charge_id uuid,
  p_stripe_intent_id text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status crate_charge_status;
  v_invoice_id uuid;
BEGIN
  SELECT status, invoice_id INTO v_status, v_invoice_id
  FROM crate_charges
  WHERE id = p_crate_charge_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crate charge not found';
  END IF;

  IF v_status = 'charged' THEN
    RETURN jsonb_build_object('already_charged', true);
  END IF;

  UPDATE crate_charges
  SET status = 'charged', stripe_payment_intent_id = p_stripe_intent_id, updated_at = now()
  WHERE id = p_crate_charge_id;

  INSERT INTO payments (tenant_id, invoice_id, amount, method, stripe_payment_intent_id, status, paid_at)
  VALUES (p_tenant_id, v_invoice_id, p_amount, 'card', p_stripe_intent_id, 'succeeded', now());

  UPDATE invoices
  SET status = 'paid', paid_at = now(), updated_at = now()
  WHERE id = v_invoice_id;

  RETURN jsonb_build_object('already_charged', false, 'success', true);
END;
$$;

-- ============================================================================
-- Mark a crate charge as failed / requires_action (called from the sweep on
-- a synchronous Stripe error, and from the webhook on an async
-- payment_intent.payment_failed). Plain tenant-scoped update, no special
-- idempotency needed here — moving into a terminal-for-this-attempt state
-- is safe to repeat.
-- ============================================================================
CREATE FUNCTION mark_crate_charge_failed(
  p_tenant_id uuid,
  p_crate_charge_id uuid,
  p_status crate_charge_status,
  p_error text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE crate_charges
  SET status = p_status, error = p_error, updated_at = now()
  WHERE id = p_crate_charge_id AND tenant_id = p_tenant_id AND status <> 'charged';
$$;
