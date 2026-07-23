-- =============================================================================
-- Migration: 00047_drop_credential_encryption_test_harness.sql
-- Description: Remove the temporary verification functions from 00045
-- =============================================================================
-- test_pgp_sym_encrypt/test_pgp_sym_decrypt existed only to verify the
-- pgp_sym_encrypt/decrypt mechanism during this branch's testing (see
-- 00045). Real encryption calls and key management belong to
-- email-imap-sync, which will design its own access path — these throwaway
-- wrappers are not part of that design and are removed now that the
-- verification evidence has been captured.

DROP FUNCTION IF EXISTS public.test_pgp_sym_encrypt(text, text);
DROP FUNCTION IF EXISTS public.test_pgp_sym_decrypt(bytea, text);
