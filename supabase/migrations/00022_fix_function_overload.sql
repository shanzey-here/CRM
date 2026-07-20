-- Migration: 00022_fix_function_overload
-- Description: Drop the old 8-parameter accept_quote_transaction overload created by 00019,
-- keeping only the new 14-parameter version from 00020.
-- The CREATE OR REPLACE in 00020 created a new overload instead of replacing because
-- the signature changed (added new optional parameters).

-- Drop the old 8-parameter version
DROP FUNCTION IF EXISTS public.accept_quote_transaction(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_lead_id uuid,
  p_contact_id uuid,
  p_move_date date,
  p_origin_address_id uuid,
  p_destination_address_id uuid,
  p_stripe_payment_intent_id text
);

-- The 14-parameter version from migration 00020 remains
