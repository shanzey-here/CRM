-- Migration: Phase 2 Crew Photos
-- Description: Adds job_photos table and job-photos storage bucket for offline crew uploads

-- 1. Create Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for job-photos
-- Crew members can upload photos for their jobs (we enforce job-level access in the app logic / bucket path)
-- Tenants can read their own photos
CREATE POLICY "Tenants can view their own job photos" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'job-photos' AND 
        (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = (string_to_array(name, '/'))[1]::uuid
    );

CREATE POLICY "Crew can upload job photos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'job-photos' AND 
        (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = (string_to_array(name, '/'))[1]::uuid
    );

-- 2. Create job_photos table
CREATE TABLE job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    caption TEXT,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT job_photos_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- RLS for job_photos
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own job photos" ON job_photos
    FOR SELECT USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "Crew can insert their own job photos" ON job_photos
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid AND
        uploaded_by = auth.uid()
    );

-- Indexes for performance
CREATE INDEX idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX idx_job_photos_tenant_id ON job_photos(tenant_id);
