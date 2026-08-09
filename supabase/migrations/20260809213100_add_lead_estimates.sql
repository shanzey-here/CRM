-- Add lead estimates
ALTER TABLE public.leads
ADD COLUMN estimated_hours numeric NULL,
ADD COLUMN estimated_crew_size numeric NULL;
