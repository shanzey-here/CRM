-- Migration: 00018_phase1_jobs_logic
-- Description: RPC function to execute quote acceptance and job creation transactionally.

-- This RPC wraps the multi-step process into a single transaction.
-- We pass the pre-calculated job details from TypeScript to keep business logic in the app,
-- but use this RPC to ensure ACID guarantees since Supabase REST API lacks BEGIN/COMMIT.
CREATE OR REPLACE FUNCTION accept_quote_transaction(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_lead_id uuid,
  p_contact_id uuid,
  p_move_date date,
  p_origin_address_id uuid,
  p_destination_address_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass RLS in the transaction
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- 1. Update quote status to accepted
  -- We ensure it is currently in 'sent' status to prevent double-acceptance.
  UPDATE quotes 
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id AND status = 'sent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in sent status';
  END IF;

  -- 2. Insert the Job
  INSERT INTO jobs (
    tenant_id, 
    quote_id, 
    contact_id, 
    status, 
    move_date, 
    origin_address_id, 
    destination_address_id
  )
  VALUES (
    p_tenant_id, 
    p_quote_id, 
    p_contact_id, 
    'scheduled', 
    p_move_date, 
    p_origin_address_id, 
    p_destination_address_id
  )
  RETURNING id INTO v_job_id;

  -- 3. Update the Lead stage to 'confirmed_booking' if a lead exists
  IF p_lead_id IS NOT NULL THEN
    UPDATE leads 
    SET stage = 'confirmed_booking', updated_at = now()
    WHERE id = p_lead_id AND tenant_id = p_tenant_id;
  END IF;

  -- 4. Emit the Domain Event
  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (p_tenant_id, 'quote.accepted', 'quoting', jsonb_build_object('quote_id', p_quote_id, 'job_id', v_job_id));

  RETURN jsonb_build_object('job_id', v_job_id);
END;
$$;
