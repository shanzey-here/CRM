-- Migration: 00021_refresh_schema_cache
-- Description: Minimal change to force PostgREST schema cache invalidation
-- This resolves the issue where the schema cache was stale after updating accept_quote_transaction

-- Add and remove a comment to trigger re-introspection
COMMENT ON FUNCTION accept_quote_transaction(uuid, uuid, uuid, uuid, date, uuid, uuid, text, numeric, numeric, numeric, jsonb, jsonb, jsonb) IS 'Accepts a quote and creates invoice with pre-computed plan (schema cache refresh)';
