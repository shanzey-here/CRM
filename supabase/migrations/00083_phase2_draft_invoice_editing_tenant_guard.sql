-- Migration: 00083_phase2_draft_invoice_editing_tenant_guard
-- Description: update_draft_invoice is SECURITY DEFINER and previously trusted its
-- p_tenant_id argument unconditionally. Because it bypasses RLS, any authenticated
-- user calling the RPC directly (not through the Server Action) could pass another
-- tenant's real tenant_id + invoice_id and successfully edit that tenant's invoice,
-- as long as the invoice was draft with no payments. The Server Action always
-- resolves tenantId server-side from the caller's own JWT, so this was unreachable
-- through the real UI/app flow — but the RPC itself, the layer this design explicitly
-- relies on as the "real, unbypassable guarantee", did not itself enforce tenant
-- ownership. This adds that check using the same public.current_tenant_id() helper
-- already used throughout this codebase's RLS policies to resolve the calling
-- session's real tenant from JWT app_metadata.

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
  IF p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch' USING ERRCODE = 'P0012';
  END IF;

  SELECT status, tax_amount INTO v_status, v_tax_amount
  FROM invoices
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Invoice is no longer in draft status' USING ERRCODE = 'P0010';
  END IF;

  IF EXISTS (
    SELECT 1 FROM payments
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Invoice already has a real payment recorded against it' USING ERRCODE = 'P0011';
  END IF;

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
      p_tenant_id, p_invoice_id, v_item->>'description',
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      v_amount, (v_item->>'sort_order')::int
    );
  END LOOP;

  UPDATE invoices
  SET subtotal = v_new_subtotal,
      total = v_new_subtotal + v_tax_amount,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'new_total', v_new_subtotal + v_tax_amount);
END;
$$;
