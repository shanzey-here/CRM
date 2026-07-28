-- =============================================================================
-- Migration: 00004_phase0_event_bus.sql
-- Description: Domain-events outbox helpers and indexes.
-- =============================================================================

-- 1. Add index for event consumers to poll efficiently
CREATE INDEX IF NOT EXISTS idx_domain_events_tenant_processed 
ON domain_events(tenant_id, processed_at);

-- 2. Create the helper function to emit events
CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_event_type text,
  p_source_module text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER -- Runs with the privileges of the calling user (relies on RLS)
AS $$
DECLARE
  v_tenant_id uuid;
  v_event_id uuid;
BEGIN
  -- Extract tenant context
  v_tenant_id := public.current_tenant_id();

  -- Strict Guard: Fail loudly if there is no tenant context
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot emit event "%" without an active tenant context', p_event_type;
  END IF;

  -- Insert the event
  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (v_tenant_id, p_event_type, p_source_module, p_payload)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
