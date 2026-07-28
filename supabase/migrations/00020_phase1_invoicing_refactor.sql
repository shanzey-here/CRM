-- Migration: 00020_phase1_invoicing_refactor
-- Description: Refactors accept_quote_transaction to accept pre-computed invoice plan from TypeScript,
-- making invoice generation explicitly testable at the application layer rather than SQL-side business logic.
-- Also adds a unique constraint to prevent duplicate invoices per job.

ALTER TABLE invoices ADD CONSTRAINT invoices_one_per_job UNIQUE (tenant_id, job_id);

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
  v_deposit_schedule_id uuid;
  v_item jsonb;
BEGIN
  -- 1. Lock and guard: only a 'sent' quote can be accepted
  -- This is the single idempotency point: a second call finds status='accepted' and raises P0002
  PERFORM 1 FROM quotes
  WHERE id = p_quote_id AND tenant_id = p_tenant_id AND status = 'sent'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in sent status' USING ERRCODE = 'P0002';
  END IF;

  UPDATE quotes
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id;

  -- 2. Create the Job
  INSERT INTO jobs (
    tenant_id, quote_id, contact_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, p_quote_id, p_contact_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
  )
  RETURNING id INTO v_job_id;

  -- 3. Update Lead stage if present
  IF p_lead_id IS NOT NULL THEN
    UPDATE leads
    SET stage = 'confirmed_booking', updated_at = now()
    WHERE id = p_lead_id AND tenant_id = p_tenant_id;
  END IF;

  -- 4. Emit event
  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (
    p_tenant_id,
    'quote.accepted',
    'quoting',
    jsonb_build_object('quote_id', p_quote_id, 'job_id', v_job_id)
  );

  -- 5. Create Invoice with PRE-COMPUTED values (no derivation in SQL)
  INSERT INTO invoices (
    tenant_id, job_id, contact_id, status, subtotal, tax_amount, total, issued_at
  )
  VALUES (
    p_tenant_id, v_job_id, p_contact_id, 'draft', p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, current_date
  )
  RETURNING id INTO v_invoice_id;

  -- 6. Insert line items from pre-computed array
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

  -- 7. Create payment schedules from pre-computed values
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

    -- Record the Stripe payment if present
    IF p_stripe_payment_intent_id IS NOT NULL THEN
      INSERT INTO payments (
        tenant_id, invoice_id, payment_schedule_id, amount, method, stripe_payment_intent_id, status, paid_at
      )
      VALUES (
        p_tenant_id,
        v_invoice_id,
        v_deposit_schedule_id,
        (p_deposit_schedule->>'amount')::numeric,
        'card',
        p_stripe_payment_intent_id,
        'succeeded',
        now()
      );
    END IF;
  END IF;

  -- Balance schedule
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

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;
