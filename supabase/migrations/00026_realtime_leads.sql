-- Enable Supabase Realtime for the leads table
-- Note: This idempotently attempts to add leads to the publication.
-- If already present (from prior runs), the error is safely ignored.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE leads;
EXCEPTION WHEN duplicate_object THEN
  -- Already a member of the publication; no action needed
END;
$$;
