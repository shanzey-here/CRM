-- Migration: 00028_add_manual_job_transaction
-- Description: Adds a transaction to create a Job manually without a Quote, generating an initial draft invoice.

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
  v_item jsonb;
BEGIN
  -- 1. Create the Job (no quote_id)
  INSERT INTO jobs (
    tenant_id, quote_id, contact_id, status, move_date, origin_address_id, destination_address_id
  )
  VALUES (
    p_tenant_id, NULL, p_contact_id, 'scheduled', p_move_date, p_origin_address_id, p_destination_address_id
  )
  RETURNING id INTO v_job_id;

  -- 2. Emit event
  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (
    p_tenant_id,
    'job.created_manually',
    'jobs',
    jsonb_build_object('job_id', v_job_id)
  );

  -- 3. Create Draft Invoice to snapshot the price immediately
  INSERT INTO invoices (
    tenant_id, job_id, contact_id, status, subtotal, tax_amount, total, issued_at
  )
  VALUES (
    p_tenant_id, v_job_id, p_contact_id, 'draft', p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, current_date
  )
  RETURNING id INTO v_invoice_id;

  -- 4. Insert line items
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

  -- Create a default payment schedule for the balance (due on move date)
  INSERT INTO payment_schedules (
    tenant_id, invoice_id, description, amount, due_date, status
  )
  VALUES (
    p_tenant_id,
    v_invoice_id,
    'Balance Due',
    p_invoice_total,
    COALESCE(p_move_date, current_date),
    'pending'
  );

  RETURN jsonb_build_object('job_id', v_job_id, 'invoice_id', v_invoice_id);
END;
$$;
