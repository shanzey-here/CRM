-- =============================================================================
-- HOTFIX: emit_domain_event() function signature conflict
-- =============================================================================
-- The migration 00006 tried to use CREATE OR REPLACE with a new optional
-- parameter, but PostgreSQL cannot resolve which version to use when called
-- with 3 arguments. This hotfix drops the conflicting version and recreates
-- with explicit signature.
-- =============================================================================

DROP FUNCTION IF EXISTS public.emit_domain_event(text, text, jsonb);

CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_event_type text,
  p_source_module text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_tenant_id uuid;
  v_event_id uuid;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'p_tenant_id override is only permitted for service_role callers';
    END IF;
    v_tenant_id := p_tenant_id;
  ELSE
    v_tenant_id := public.current_tenant_id();
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot emit event "%" without an active tenant context', p_event_type;
  END IF;

  INSERT INTO domain_events (tenant_id, event_type, source_module, payload)
  VALUES (v_tenant_id, p_event_type, p_source_module, p_payload)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
