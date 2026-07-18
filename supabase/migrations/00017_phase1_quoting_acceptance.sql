-- 00017_phase1_quoting_acceptance.sql

-- 1. Add Stripe Connect Account ID to tenants
ALTER TABLE tenants 
ADD COLUMN stripe_connected_account_id text;

-- 2. Create the Storage bucket for signatures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'signatures' bucket
-- Only tenant_admin and dispatcher can read from the bucket.
-- (The insert is handled via service-role in the server action to bypass RLS, as the signer is unauthenticated)

CREATE POLICY "Allow staff to read signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures' 
  AND (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'dispatcher')
    )
  )
);

-- 3. Create the quote_signatures table
CREATE TABLE quote_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL,
  signature_name text NOT NULL,
  signature_storage_path text NOT NULL,
  document_hash text NOT NULL,
  ip_address text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_signatures_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT quote_signatures_quote_fk FOREIGN KEY (quote_id, tenant_id)
    REFERENCES quotes(id, tenant_id) ON DELETE CASCADE
);

-- Index for fast lookup by quote_id
CREATE INDEX idx_quote_signatures_quote_id ON quote_signatures(quote_id);

-- RLS for quote_signatures
ALTER TABLE quote_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their tenant's quote signatures"
ON quote_signatures FOR SELECT
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('tenant_admin', 'dispatcher')
);

-- Note: No INSERT policy for quote_signatures. 
-- The public proposal page will insert the signature via a Supabase Service Role client, 
-- ensuring the customer cannot write to arbitrary tables.
