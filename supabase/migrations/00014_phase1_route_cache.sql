-- Migration: 00014_phase1_route_cache.sql
-- Description: Creates a global route cache with strict RLS for tenant staff.

CREATE TABLE public.route_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_key text NOT NULL,
  destination_key text NOT NULL,
  distance_meters int NOT NULL,
  duration_seconds int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Uniqueness to prevent duplicate exact routes
  CONSTRAINT route_cache_origin_dest_key UNIQUE (origin_key, destination_key)
);

-- Enable RLS
ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Select
-- Only authenticated users who are tenant_admin or dispatcher can read.
CREATE POLICY "Staff can read route cache"
  ON public.route_cache
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- Policy: Insert
-- Only authenticated users who are tenant_admin or dispatcher can insert.
CREATE POLICY "Staff can insert route cache"
  ON public.route_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- Policy: Update
-- Needed because of the 90-day expiry re-fetch which updates existing rows.
CREATE POLICY "Staff can update route cache"
  ON public.route_cache
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- Index for speedy lookups
CREATE INDEX idx_route_cache_keys ON public.route_cache(origin_key, destination_key);
