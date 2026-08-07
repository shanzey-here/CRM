-- =============================================================================
-- Migration: 00082_phase2_draft_invoice_editing.sql
-- Description: Allows editing a draft invoice's line items and notes, gated
-- atomically at the database level — never trusting the Server Action's
-- own status check alone.
--
-- Two guards, both re-checked inside this transaction under FOR UPDATE:
--   1. status = 'draft' — an invoice that has ever left draft stays exactly
--      as immutable as it already is today.
--   2. no rows in payments for this invoice — a draft invoice can already
--      carry a real, paid deposit (accept_quote_transaction inserts
--      payments while the invoice is still 'draft'), and this system has
--      no "sent" gate: a draft invoice is already visible to and payable
--      by the real customer via the portal today. Editing line items on an
--      invoice a customer has put real money against is exactly the kind
--      of silent financial drift this project's immutability principle
--      exists to prevent, so it's blocked regardless of status.
--
-- The FOR UPDATE lock on the invoice row is the same one record_invoice_payment
-- already takes, so a concurrent payment webhook and this edit cannot
-- interleave — whichever transaction commits first wins, and the other
-- re-reads a state that no longer satisfies its own guard and rejects.
--
-- amount is always recomputed server-side as quantity * unit_price, never
-- trusted from the client. subtotal/total are always derived from the sum
-- of line items, never independently settable. tax_amount is left
-- untouched (no tax-rate concept exists yet — computeInvoicePlan always
-- sets it to 0; this RPC doesn't touch it either way).
-- =============================================================================

CREATE OR REPLACE FUNCTION update_draft_invoice(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_notes text,
  p_line_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status invoice_status;
  v_tax_amount numeric;
  v_new_subtotal numeric := 0;
  v_item jsonb;
  v_amount numeric;
BEGIN
  -- 1. Lock the invoice row — the same lock record_invoice_payment takes,
  -- so a concurrent payment can't interleave with this edit.
  SELECT status, tax_amount INTO v_status, v_tax_amount
  FROM invoices
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Guard 1: must still genuinely be draft at the moment of write.
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Invoice is no longer in draft status' USING ERRCODE = 'P0010';
  END IF;

  -- 3. Guard 2: no real payment may exist against this invoice, even if
  -- status still reads 'draft' (e.g. a paid deposit recorded at
  -- quote-acceptance time, before any balance payment flips the status).
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Invoice already has a real payment recorded against it' USING ERRCODE = 'P0011';
  END IF;

  -- 4. Replace line items atomically. amount is always recomputed here,
  -- never taken from the client payload.
  DELETE FROM invoice_line_items
  WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_amount := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    v_new_subtotal := v_new_subtotal + v_amount;

    INSERT INTO invoice_line_items (
      tenant_id, invoice_id, description, quantity, unit_price, amount, sort_order
    )
    VALUES (
      p_tenant_id,
      p_invoice_id,
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      v_amount,
      (v_item->>'sort_order')::int
    );
  END LOOP;

  -- 5. Update the invoice's own derived totals + notes. Re-scoped by
  -- tenant_id and id again here (belt and suspenders on top of the lock).
  UPDATE invoices
  SET subtotal = v_new_subtotal,
      total = v_new_subtotal + v_tax_amount,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'new_total', v_new_subtotal + v_tax_amount);
END;
$$;
