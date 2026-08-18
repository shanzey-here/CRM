-- 00073_phase3_job_signatures_bucket.sql

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_signatures', 'job_signatures', false)
ON CONFLICT (id) DO NOTHING;



-- 3. Policy: Crew can insert signatures into the job_signatures bucket
CREATE POLICY "Crew can insert signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_signatures'
);

-- 4. Policy: Staff and crew can view signatures in the job_signatures bucket
CREATE POLICY "Staff and crew can view signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_signatures'
);
