-- ==============================================================================
-- 00015_phase1_pricing_calculation.sql
-- Pricing Calculation Infrastructure
-- ==============================================================================
-- Adds labour_hours_per_cubicft to pricing_settings, and computed/final price
-- columns to quotes. Creates quote_surcharges table for surcharge snapshots
-- and audit trail (amounts locked at calculation time).
-- ==============================================================================

-- A. pricing_settings — add labour_hours_per_cubicft
ALTER TABLE pricing_settings
  ADD COLUMN labour_hours_per_cubicft numeric(12,2) NOT NULL DEFAULT 0.1;

-- B. quotes — add computed_price and final_price
ALTER TABLE quotes
  ADD COLUMN computed_price numeric(12,2),
  ADD COLUMN final_price numeric(12,2);

-- C. quote_surcharges — audit trail for applied surcharges (immutable once quote leaves draft)
CREATE TABLE quote_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  surcharge_key text NOT NULL,
  surcharge_label text,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(quote_id, surcharge_key),
  CONSTRAINT quote_surcharges_tenant_unique UNIQUE (quote_id, surcharge_key, tenant_id)
);

CREATE INDEX idx_quote_surcharges_quote ON quote_surcharges(quote_id);
CREATE INDEX idx_quote_surcharges_tenant ON quote_surcharges(tenant_id);

-- D. RLS for quote_surcharges
ALTER TABLE quote_surcharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_surcharges FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON quote_surcharges FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

CREATE POLICY admin_dispatcher_all ON quote_surcharges FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- E. RPC: calculate_quote_price — safe pricing calculation with draft-status guard
CREATE OR REPLACE FUNCTION public.calculate_quote_price(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_total_volume numeric,
  p_distance_meters integer,
  p_selected_surcharge_keys text[]
)
RETURNS TABLE (
  computed_price numeric,
  volume_cost numeric,
  distance_cost numeric,
  labour_cost numeric,
  surcharge_total numeric,
  subtotal numeric,
  minimum_adjustment numeric,
  final_total numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_quote_status quote_status;
  v_pricing pricing_settings;
  v_distance_miles numeric;
  v_labour_hours numeric;
  v_surcharges_json jsonb;
  v_surcharge_obj jsonb;
  v_surcharge_amount numeric;
  v_surcharge_sum numeric := 0;
  v_subtotal numeric;
  v_minimum_adj numeric;
  v_total numeric;
  v_volume_cost numeric;
  v_distance_cost numeric;
  v_labour_cost numeric;
BEGIN
  -- 1. Guard: Quote must be in draft status
  SELECT status INTO v_quote_status FROM quotes
    WHERE id = p_quote_id AND tenant_id = p_tenant_id;

  IF v_quote_status IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote_status <> 'draft' THEN
    RAISE EXCEPTION 'Cannot recalculate price for non-draft quote (status: %)', v_quote_status;
  END IF;

  -- 2. Fetch pricing_settings for tenant
  SELECT * INTO v_pricing FROM pricing_settings
    WHERE tenant_id = p_tenant_id;

  IF v_pricing IS NULL THEN
    RAISE EXCEPTION 'Pricing settings not found for tenant';
  END IF;

  -- 3. Convert distance: meters to miles (1609.34 meters = 1 mile)
  v_distance_miles := p_distance_meters::numeric / 1609.34;

  -- 4. Calculate component costs
  v_volume_cost := p_total_volume * v_pricing.per_cubic_foot_rate;
  v_distance_cost := v_distance_miles * v_pricing.per_mile_rate;

  v_labour_hours := p_total_volume * v_pricing.labour_hours_per_cubicft;
  v_labour_cost := v_labour_hours * v_pricing.labor_hourly_rate;

  -- 5. Calculate surcharges (sum fixed amounts from selected keys)
  IF p_selected_surcharge_keys IS NOT NULL AND array_length(p_selected_surcharge_keys, 1) > 0 THEN
    v_surcharges_json := v_pricing.surcharges;

    -- Iterate surcharges array and sum amounts for selected keys
    FOR v_surcharge_obj IN SELECT jsonb_array_elements(v_surcharges_json)
    LOOP
      IF (v_surcharge_obj->>'key') = ANY(p_selected_surcharge_keys) THEN
        v_surcharge_amount := (v_surcharge_obj->>'amount')::numeric;
        v_surcharge_sum := v_surcharge_sum + v_surcharge_amount;
      END IF;
    END LOOP;
  END IF;

  -- 6. Calculate subtotal and minimum adjustment
  v_subtotal := v_volume_cost + v_distance_cost + v_labour_cost + v_surcharge_sum;

  IF v_subtotal < v_pricing.base_rate THEN
    v_minimum_adj := v_pricing.base_rate - v_subtotal;
    v_total := v_pricing.base_rate;
  ELSE
    v_minimum_adj := 0;
    v_total := v_subtotal;
  END IF;

  -- 7. Return breakdown
  RETURN QUERY SELECT
    v_total,
    v_volume_cost,
    v_distance_cost,
    v_labour_cost,
    v_surcharge_sum,
    v_subtotal,
    v_minimum_adj,
    v_total;
END;
$$;
