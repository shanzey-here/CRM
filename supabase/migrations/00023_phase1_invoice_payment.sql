-- Migration: 00023_phase1_invoice_payment
-- Description: RPC for safely recording an asynchronous Stripe invoice payment. Includes idempotency guard via FOR UPDATE lock.

CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_schedule_id uuid,
  p_stripe_intent_id text,
  p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status text;
  v_invoice_total numeric;
  v_total_paid numeric;
BEGIN
  -- 1. Lock the specific payment_schedule to prevent race conditions during concurrent webhook delivery
  SELECT status INTO v_current_status
  FROM payment_schedules
  WHERE id = p_schedule_id AND tenant_id = p_tenant_id AND invoice_id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment schedule not found';
  END IF;

  -- 2. Idempotency guard: If it's already paid, return a safe replay signal
  IF v_current_status = 'paid' THEN
    RETURN jsonb_build_object('already_paid', true);
  END IF;

  -- 3. Mark the schedule as paid
  UPDATE payment_schedules
  SET status = 'paid', updated_at = now()
  WHERE id = p_schedule_id;

  -- 4. Record the specific payment in the ledger
  INSERT INTO payments (
    tenant_id, invoice_id, payment_schedule_id, amount, method, stripe_payment_intent_id, status, paid_at
  ) VALUES (
    p_tenant_id, p_invoice_id, p_schedule_id, p_amount, 'card', p_stripe_intent_id, 'succeeded', now()
  );

  -- 5. Recalculate the overall invoice status
  -- Fetch the total amount required for the invoice
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = p_invoice_id;

  -- Sum all currently paid schedules
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payment_schedules
  WHERE invoice_id = p_invoice_id AND status = 'paid';

  -- Update invoice status
  IF v_total_paid >= v_invoice_total THEN
    UPDATE invoices
    SET status = 'paid', updated_at = now(), paid_at = now()
    WHERE id = p_invoice_id;
  ELSE
    UPDATE invoices
    SET status = 'partially_paid', updated_at = now()
    WHERE id = p_invoice_id;
  END IF;

  RETURN jsonb_build_object('already_paid', false, 'success', true);
END;
$$;
