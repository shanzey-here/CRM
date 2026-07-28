-- =============================================================================
-- Migration: 00058_phase2_social_aggregator.sql
-- Description: social-aggregator-integration — caches the tenant's Zernio
--   "profile" id (the tenant-level container Zernio's own API requires
--   before any account can be connected), so it isn't recreated on every
--   connect attempt. Separate from connected_social_accounts.aggregator_profile_id,
--   which (per real API verification) stores the per-ACCOUNT id, not the
--   per-tenant profile id — two different Zernio concepts, confirmed
--   against the live API, not assumed from the column's name alone.
-- =============================================================================

BEGIN;

ALTER TABLE public.tenant_settings ADD COLUMN social_aggregator_profile_id text;

COMMIT;
