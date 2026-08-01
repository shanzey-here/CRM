-- Force PostgREST schema cache invalidation
COMMENT ON FUNCTION accept_quote_transaction(uuid, uuid, uuid, uuid, date, uuid, uuid, text, numeric, numeric, numeric, jsonb, jsonb, jsonb) IS 'Accepts a quote and creates invoice with pre-computed plan (schema cache refresh 2)';
