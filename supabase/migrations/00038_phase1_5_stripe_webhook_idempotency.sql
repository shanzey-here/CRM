-- =============================================================================
-- Migration: 00038_phase1_5_stripe_webhook_idempotency.sql
-- Description: Stripe Billing (subscriptions) webhook idempotency + sync RPC
-- =============================================================================
-- stripe_events: dedup ledger for Stripe webhook deliveries. The PRIMARY KEY
-- on event_id is the only idempotency guard — the sync RPC below inserts into
-- this table FIRST and lets the unique-constraint violation (not a prior
-- SELECT) decide whether an event has already been processed. This closes the
-- check-then-write race that a separate "has this been processed?" query
-- would leave open under concurrent Stripe retries.

BEGIN;

CREATE TABLE public.stripe_events (
  event_id    text PRIMARY KEY,
  event_type  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Service role only — this table is an internal webhook-processing ledger,
-- never read or written by tenant sessions.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view webhook event log"
ON public.stripe_events FOR SELECT
USING (public.is_super_admin() = true);

-- No INSERT/UPDATE/DELETE policy for any role — only the SECURITY DEFINER
-- RPC below (which runs with elevated privileges) can write to this table.

-- =============================================================================
-- sync_tenant_subscription_from_webhook
-- =============================================================================
-- Single, atomic entry point for every Stripe subscription-lifecycle event
-- that mutates tenant_subscriptions. Called by the webhook handler after
-- signature verification and tenant resolution (via subscription metadata or
-- tenants.stripe_customer_id) — this function trusts its arguments completely,
-- so the caller must never pass a client-supplied tenant_id.
--
-- Idempotency: the INSERT into stripe_events is the first statement. If
-- event_id already exists, the unique_violation is caught and the function
-- returns {processed: false, reason: 'duplicate_event'} WITHOUT touching
-- tenant_subscriptions — so the webhook handler can safely return 200 for a
-- retried delivery without redoing (or double-doing) any state change.
--
-- Partial updates: every field except tenant_id/event_id/event_type defaults
-- to NULL, and NULL means "leave this field unchanged" (COALESCE against the
-- existing row) — same pattern as set_staff_status() in migration 00027.
-- This lets invoice.payment_failed set ONLY status='past_due' without
-- clobbering price_id/current_period_end/cancel_at_period_end, which that
-- event does not carry authoritative values for.
--
-- Never inserts into tenant_subscriptions — every tenant already has exactly
-- one row from handle_new_tenant(), so this is always an UPDATE keyed on the
-- tenant_id resolved by the caller.
CREATE OR REPLACE FUNCTION public.sync_tenant_subscription_from_webhook(
  p_event_id text,
  p_event_type text,
  p_tenant_id uuid,
  p_stripe_subscription_id text DEFAULT NULL,
  p_status public.tenant_status DEFAULT NULL,
  p_price_id uuid DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT NULL,
  p_clear_price_id boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count int;
BEGIN
  -- Atomic idempotency guard: this INSERT is the ONLY check. A concurrent
  -- retry either wins this insert and proceeds, or loses it and jumps
  -- straight to the EXCEPTION block before any tenant_subscriptions write.
  INSERT INTO public.stripe_events (event_id, event_type)
  VALUES (p_event_id, p_event_type);

  UPDATE public.tenant_subscriptions
  SET
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    status = COALESCE(p_status, status),
    -- p_clear_price_id lets a caller explicitly null out price_id (e.g. a
    -- Stripe price with no local saas_prices match yet) without that NULL
    -- being swallowed by COALESCE as "no change".
    price_id = CASE WHEN p_clear_price_id THEN NULL ELSE COALESCE(p_price_id, price_id) END,
    current_period_end = COALESCE(p_current_period_end, current_period_end),
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, cancel_at_period_end),
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    -- Tenant resolved by the caller but has no tenant_subscriptions row —
    -- should be impossible (handle_new_tenant() guarantees one), but surface
    -- it distinctly rather than silently reporting success.
    RAISE EXCEPTION 'No tenant_subscriptions row for tenant_id %', p_tenant_id
      USING ERRCODE = 'P0004';
  END IF;

  RETURN jsonb_build_object('processed', true, 'tenant_id', p_tenant_id);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'duplicate_event', 'event_id', p_event_id);
END;
$$;

-- Grant to service_role only — the webhook handler is the sole caller, and
-- it always runs via createServiceRoleClient(). Tenant/admin sessions never
-- call this directly.
REVOKE ALL ON FUNCTION public.sync_tenant_subscription_from_webhook FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_tenant_subscription_from_webhook TO service_role;

COMMIT;
