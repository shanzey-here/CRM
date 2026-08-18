-- 00072_phase3_job_signoffs.sql

-- 1. Create the job_signoffs table
CREATE TABLE job_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  signature_name text NOT NULL,
  signature_storage_path text NOT NULL,
  document_hash text NOT NULL,
  ip_address text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  captured_by uuid REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT job_signoffs_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT job_signoffs_job_fk FOREIGN KEY (job_id, tenant_id)
    REFERENCES jobs(id, tenant_id) ON DELETE CASCADE
);

-- Index for fast lookup by job_id
CREATE INDEX idx_job_signoffs_job_id ON job_signoffs(job_id);

-- RLS for job_signoffs
ALTER TABLE job_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their tenant's job signoffs"
ON job_signoffs FOR SELECT
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('tenant_admin', 'dispatcher')
);

CREATE POLICY "Crew can insert job signoffs for their jobs"
ON job_signoffs FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM job_crew_assignments
    WHERE job_crew_assignments.job_id = job_signoffs.job_id
    AND job_crew_assignments.user_id = auth.uid()
  )
);

CREATE POLICY "Crew can read job signoffs for their jobs"
ON job_signoffs FOR SELECT
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM job_crew_assignments
    WHERE job_crew_assignments.job_id = job_signoffs.job_id
    AND job_crew_assignments.user_id = auth.uid()
  )
);

-- Note: The signatures bucket is already created in 00017.
-- The RLS on the bucket for crew to upload must be added.
-- We can add a policy allowing crew to insert objects to 'signatures' bucket
-- for paths starting with their tenant_id, similar to job-photos.

CREATE POLICY "Allow crew to insert signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures' 
  AND (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'crew'
      AND users.tenant_id::text = (string_to_array(name, '/'))[1]
    )
  )
);

-- Force schema cache reload
COMMENT ON SCHEMA public IS 'v2026-08-01-phase3';
