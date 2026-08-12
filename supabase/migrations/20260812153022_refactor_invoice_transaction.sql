-- Migration: 20260812153022_refactor_invoice_transaction
-- Description: Refactors invoice generation into a shared internal function.

-- 1. Shared Internal Function for Invoice Snapshotting
CREATE OR REPLACE FUNCTION internal_create_invoice_snapshot(
  p_tenant_id uuid,
  p_job_id uuid,
  p_contact_id uuid,
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
BEGIN
  -- Create Invoice
  INSERT INTO invoices (
    tenant_id, job_id, contact_id, status, subtotal, tax_amount, total, issued_at
  )
  VALUES (
    p_tenant_id, p_job_id, p_contact_id, 'draft', p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, current_date
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

    -- Note: record stripe payment is moved back to accept_quote_transaction 
    -- or we can handle it here if we pass p_stripe_payment_intent_id.
    -- For simplicity, if stripe_payment_intent_id is in deposit_schedule, we record it.
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


-- 2. Refactor accept_quote_transaction
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
  v_dep jsonb := p_deposit_schedule;
BEGIN
  PERFORM 1 FROM quotes
  WHERE id = p_quote_id AND tenant_id = p_tenant_id AND status = 'sent'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in sent status' USING ERRCODE = 'P0002';
  END IF;

  UPDATE quotes
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id;

  INSERT INTO jobs (
    tenant_id, quote_id, contact_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, p_quote_id, p_contact_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
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
    p_tenant_id, v_job_id, p_contact_id, p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, p_line_items, v_dep, p_balance_schedule
  );

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;


-- 3. Refactor create_manual_job_transaction
CREATE OR REPLACE FUNCTION create_manual_job_transaction(
  p_tenant_id uuid,
  p_contact_id uuid,
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
    tenant_id, quote_id, contact_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, NULL, p_contact_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
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
    p_tenant_id, v_job_id, p_contact_id, p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, p_line_items, NULL, v_balance_schedule
  );

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;
