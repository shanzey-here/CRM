-- Migration: 00019_phase1_invoicing_db
-- Description: Adds balance due offset setting, and expands accept_quote_transaction to generate invoices and payment schedules.

ALTER TABLE tenant_settings ADD COLUMN balance_due_days_before_move INT NOT NULL DEFAULT 2;

-- We redefine accept_quote_transaction to handle invoice generation in the same ACID transaction.
CREATE OR REPLACE FUNCTION accept_quote_transaction(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_lead_id uuid,
  p_contact_id uuid,
  p_move_date date,
  p_origin_address_id uuid,
  p_destination_address_id uuid,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
  v_invoice_id uuid;
  v_deposit_schedule_id uuid;
  v_subtotal numeric;
  v_surcharge numeric;
  v_total numeric;
  v_deposit numeric;
  v_balance_days int;
  v_balance_due_date date;
BEGIN
  -- 1. Fetch Quote details and lock it to ensure it is in 'sent' status
  SELECT subtotal, surcharge_total, total_price, deposit_amount
  INTO v_subtotal, v_surcharge, v_total, v_deposit
  FROM quotes
  WHERE id = p_quote_id AND tenant_id = p_tenant_id AND status = 'sent'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in sent status';
  END IF;

  -- 2. Update quote status to accepted
  UPDATE quotes 
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id;

  -- 3. Insert the Job
  INSERT INTO jobs (
    tenant_id, quote_id, contact_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, p_quote_id, p_contact_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
  )
  RETURNING id INTO v_job_id;

  -- 4. Update the Lead stage to 'confirmed_booking' if a lead exists
  IF p_lead_id IS NOT NULL THEN
    UPDATE leads 
    SET stage = 'confirmed_booking', updated_at = now()
    WHERE id = p_lead_id AND tenant_id = p_tenant_id;
  END IF;

  -- 5. Emit the Domain Event
  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (p_tenant_id, 'quote.accepted', 'quoting', jsonb_build_object('quote_id', p_quote_id, 'job_id', v_job_id));

  -- 6. Generate the Invoice
  INSERT INTO invoices (
    tenant_id, job_id, contact_id, status, subtotal, tax_amount, total, issued_at
  ) VALUES (
    p_tenant_id, v_job_id, p_contact_id, 'draft', v_subtotal, 0, v_total, current_date
  ) RETURNING id INTO v_invoice_id;

  -- 7. Insert Invoice Line Items
  INSERT INTO invoice_line_items (tenant_id, invoice_id, description, quantity, unit_price, amount, sort_order)
  VALUES (p_tenant_id, v_invoice_id, 'Removals Service', 1, v_subtotal, v_subtotal, 1);

  IF v_surcharge > 0 THEN
    INSERT INTO invoice_line_items (tenant_id, invoice_id, description, quantity, unit_price, amount, sort_order)
    VALUES (p_tenant_id, v_invoice_id, 'Surcharges', 1, v_surcharge, v_surcharge, 2);
  END IF;

  -- 8. Fetch Balance Due Offset
  SELECT balance_due_days_before_move INTO v_balance_days
  FROM tenant_settings
  WHERE tenant_id = p_tenant_id;
  
  IF v_balance_days IS NULL THEN
    v_balance_days := 2;
  END IF;
  
  v_balance_due_date := p_move_date - v_balance_days;

  -- 9. Create Payment Schedules
  IF v_deposit > 0 THEN
    -- Deposit Schedule
    INSERT INTO payment_schedules (tenant_id, invoice_id, description, amount, due_date, status)
    VALUES (p_tenant_id, v_invoice_id, 'Deposit', v_deposit, current_date, 'paid')
    RETURNING id INTO v_deposit_schedule_id;

    -- Record Payment if Stripe ID provided
    IF p_stripe_payment_intent_id IS NOT NULL THEN
      INSERT INTO payments (
        tenant_id, invoice_id, payment_schedule_id, amount, method, stripe_payment_intent_id, status, paid_at
      ) VALUES (
        p_tenant_id, v_invoice_id, v_deposit_schedule_id, v_deposit, 'card', p_stripe_payment_intent_id, 'succeeded', now()
      );
    END IF;

    -- Balance Schedule
    INSERT INTO payment_schedules (tenant_id, invoice_id, description, amount, due_date, status)
    VALUES (p_tenant_id, v_invoice_id, 'Balance', v_total - v_deposit, v_balance_due_date, 'pending');

  ELSE
    -- No deposit, single balance schedule
    INSERT INTO payment_schedules (tenant_id, invoice_id, description, amount, due_date, status)
    VALUES (p_tenant_id, v_invoice_id, 'Total Balance', v_total, v_balance_due_date, 'pending');
  END IF;

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;
