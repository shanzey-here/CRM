-- =============================================================================
-- Migration: 00045_temp_credential_encryption_test_harness.sql
-- Description: TEMPORARY — verifies pgp_sym_encrypt/decrypt mechanism for
--              mailboxes.encrypted_credential, dropped by migration 00046
-- =============================================================================
-- pgp_sym_encrypt/pgp_sym_decrypt live in a schema PostgREST doesn't expose
-- for direct RPC calls, so there's no way to drive this verification from
-- application code without a thin wrapper. These two functions exist only to
-- prove the encryption mechanism this branch's design relies on actually
-- works as claimed — not part of the real credential-storage flow, which
-- email-imap-sync will design (including real key management). service_role
-- only; dropped immediately after the verification run in 00046.

CREATE OR REPLACE FUNCTION public.test_pgp_sym_encrypt(p_plaintext text, p_key text)
RETURNS bytea
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT extensions.pgp_sym_encrypt(p_plaintext, p_key);
$$;

CREATE OR REPLACE FUNCTION public.test_pgp_sym_decrypt(p_ciphertext bytea, p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT extensions.pgp_sym_decrypt(p_ciphertext, p_key);
$$;

REVOKE ALL ON FUNCTION public.test_pgp_sym_encrypt FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_pgp_sym_decrypt FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_pgp_sym_encrypt TO service_role;
GRANT EXECUTE ON FUNCTION public.test_pgp_sym_decrypt TO service_role;
