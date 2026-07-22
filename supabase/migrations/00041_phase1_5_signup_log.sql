CREATE TABLE public.public_signup_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address inet NOT NULL,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    outcome text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Index for fast rate-limiting queries
CREATE INDEX idx_public_signup_log_ip_created_at ON public.public_signup_log (ip_address, created_at);

-- RLS: Service Role Only (Never accessed from client)
ALTER TABLE public.public_signup_log ENABLE ROW LEVEL SECURITY;
