-- Tracks exactly when a subscription's status genuinely transitioned INTO
-- past_due, so a real 7-day access bound can be computed from it. Not the
-- same as updated_at: the sync RPC below sets updated_at = now() on every
-- webhook-driven update, including Stripe's own repeated dunning retries
-- that re-fire invoice.payment_failed while a subscription is already
-- past_due — using updated_at as the clock would silently reset a 7-day
-- bound on every retry and it would never actually trigger.
ALTER TABLE public.tenant_subscriptions ADD COLUMN past_due_since timestamptz;

-- Additive logic only — same signature, same idempotency guard, same
-- COALESCE-based partial-update behavior for every other field. Only the
-- past_due_since CASE is new. The CASE branches read `status` (the
-- pre-update value) because a single UPDATE statement evaluates every SET
-- expression against the row as it was before this statement, not against
-- values already assigned earlier in the same SET list.
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
  INSERT INTO public.stripe_events (event_id, event_type)
  VALUES (p_event_id, p_event_type);

  UPDATE public.tenant_subscriptions
  SET
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    status = COALESCE(p_status, status),
    price_id = CASE WHEN p_clear_price_id THEN NULL ELSE COALESCE(p_price_id, price_id) END,
    current_period_end = COALESCE(p_current_period_end, current_period_end),
    cancel_at_period_end = COALESCE(p_cancel_at_period_end, cancel_at_period_end),
    past_due_since = CASE
      WHEN p_status IS NULL THEN past_due_since
      WHEN p_status = 'past_due' AND status <> 'past_due' THEN now()
      WHEN p_status <> 'past_due' THEN NULL
      ELSE past_due_since
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'No tenant_subscriptions row for tenant_id %', p_tenant_id
      USING ERRCODE = 'P0004';
  END IF;

  RETURN jsonb_build_object('processed', true, 'tenant_id', p_tenant_id);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'duplicate_event', 'event_id', p_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_tenant_subscription_from_webhook FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_tenant_subscription_from_webhook TO service_role;
