-- =============================================================================
-- 00006_phase1_leads_public_api.sql
-- Public lead-capture form infrastructure: per-tenant form keys, a
-- rate-limit/abuse log, and a service-role-only tenant override on
-- emit_domain_event() so the public endpoint (no user session) can still
-- emit domain events through the same function every other caller uses.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. tenant_form_keys — non-guessable public token, resolved server-side to a
-- tenant_id. The public endpoint never accepts a client-supplied tenant_id;
-- this is the only thing a client controls, and it only ever maps to one
-- specific tenant. Dedicated table (not a tenants column) so a key can be
-- rotated/revoked without touching the tenant row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tenant_form_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'), -- 192 bits, non-guessable
  label         text,
  is_active     boolean NOT NULL DEFAULT true,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);

CREATE INDEX idx_tenant_form_keys_tenant ON tenant_form_keys(tenant_id);
CREATE INDEX idx_tenant_form_keys_key_active ON tenant_form_keys(key) WHERE is_active;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_form_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tenant_form_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_form_keys FORCE ROW LEVEL SECURITY;

-- Same posture as every other tenant table. No `anon` policy: the public
-- route resolves key -> tenant_id via the service-role client, which
-- bypasses RLS entirely — consistent with how every other "no session"
-- access in this codebase is handled.
CREATE POLICY super_admin_all ON tenant_form_keys FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON tenant_form_keys FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- B. public_lead_submission_log — rate-limiting counter + abuse forensics for
-- the public endpoint. Never stores the raw form key or submitted PII, only
-- enough to count recent attempts by IP/tenant and let a tenant see how much
-- spam hits their form. Written exclusively by the service-role route.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public_lead_submission_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL when the form key didn't resolve
  ip_address  text NOT NULL,
  outcome     text NOT NULL CHECK (outcome IN ('created', 'invalid_key', 'rate_limited', 'honeypot', 'validation_error')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_lead_log_ip_created ON public_lead_submission_log(ip_address, created_at);
CREATE INDEX idx_public_lead_log_tenant_created ON public_lead_submission_log(tenant_id, created_at);

ALTER TABLE public_lead_submission_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_lead_submission_log FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON public_lead_submission_log FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Tenant admins/dispatchers can review spam/abuse hits against their own
-- form. No INSERT/UPDATE/DELETE policy for any authenticated role — only
-- the service-role route writes to this table.
CREATE POLICY admin_dispatcher_select ON public_lead_submission_log FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C. emit_domain_event() — add an optional p_tenant_id override, honored only
-- for service_role callers. CREATE OR REPLACE with a new trailing DEFAULT
-- parameter is backward compatible: every existing 3-argument call site
-- (emitEvent() in src/utils/supabase/event-bus.ts, isolation_tests.sql)
-- keeps working unchanged. The current_user check means an authenticated
-- tenant user can never spoof another tenant's tenant_id via this override —
-- only a service-role connection (which already bypasses RLS everywhere)
-- can use it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_event_type text,
  p_source_module text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER -- Runs with the privileges of the calling user (relies on RLS)
AS $$
DECLARE
  v_tenant_id uuid;
  v_event_id uuid;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    -- Only a service-role connection (no user session, e.g. the public
    -- lead-capture endpoint) may supply an explicit tenant_id.
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'p_tenant_id override is only permitted for service_role callers';
    END IF;
    v_tenant_id := p_tenant_id;
  ELSE
    -- Extract tenant context
    v_tenant_id := public.current_tenant_id();
  END IF;

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
