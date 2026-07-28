-- ==============================================================================
-- 00016_phase1_quoting_proposal.sql
-- Public Proposal Page Infrastructure
-- ==============================================================================
-- Adds public_token column to quotes for non-guessable shareable links.
-- Token is generated on-demand (when dispatcher wants to share), not at quote creation.
-- Service-role public route resolves token → quote without authentication.
-- ==============================================================================

-- A. quotes — add public_token for shareable proposal links
ALTER TABLE quotes
  ADD COLUMN public_token text UNIQUE;

CREATE INDEX idx_quotes_public_token ON quotes(public_token);

-- B. Helper function: generate_proposal_token
-- Returns a 192-bit non-guessable token in hex format.
-- Same strength as tenant_form_keys.key (encode(gen_random_bytes(24), 'hex')).
CREATE OR REPLACE FUNCTION public.generate_proposal_token()
RETURNS text
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT encode(extensions.gen_random_bytes(24), 'hex');
$$;
