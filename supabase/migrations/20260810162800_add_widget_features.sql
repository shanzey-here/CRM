-- Add public_widget_key to tenants
ALTER TABLE public.tenants 
ADD COLUMN public_widget_key UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add a unique constraint to ensure fast lookups
ALTER TABLE public.tenants
ADD CONSTRAINT tenants_public_widget_key_key UNIQUE (public_widget_key);

-- Create a simple rate limit table
CREATE TABLE public.widget_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    widget_key UUID REFERENCES public.tenants(public_widget_key) ON DELETE CASCADE,
    count INT DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookup and pruning
CREATE INDEX idx_widget_rate_limits_lookup ON public.widget_rate_limits(ip_address, widget_key);
CREATE INDEX idx_widget_rate_limits_expires ON public.widget_rate_limits(expires_at);

-- RLS for widget_rate_limits
ALTER TABLE public.widget_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits
CREATE POLICY "Service role full access to widget_rate_limits"
ON public.widget_rate_limits
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');
