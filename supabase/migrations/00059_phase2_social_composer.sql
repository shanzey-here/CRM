-- 00059_phase2_social_composer.sql
-- Scheduled/immediate social posts — a "post now" is just a row with
-- scheduled_for = now() that gets claimed and published synchronously
-- instead of picked up later by the cron sweep. One table, one status
-- model, one history list.

CREATE TYPE scheduled_post_status AS ENUM ('pending', 'published', 'partial', 'failed', 'cancelled');

CREATE TABLE scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content text NOT NULL,
  account_ids uuid[] NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status scheduled_post_status NOT NULL DEFAULT 'pending',
  -- Atomic claim marker — same guard shape as email_messages.claimed_at
  -- (see approveAiDraftAction): a single UPDATE ... WHERE status='pending'
  -- AND claimed_at IS NULL ... RETURNING * is what makes the cron sweep and
  -- "post now" path safe under concurrent/overlapping invocations.
  claimed_at timestamptz,
  -- Full PublishBatchResult[] shape, always stored regardless of status —
  -- the row-level status is a summary, this is the real per-account detail.
  publish_results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_scheduled_posts_tenant ON scheduled_posts(tenant_id);
CREATE INDEX idx_scheduled_posts_due ON scheduled_posts(status, scheduled_for) WHERE claimed_at IS NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON scheduled_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON scheduled_posts
  FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Admins and Dispatchers can do everything on their tenant's scheduled posts
CREATE POLICY admin_dispatcher_all ON scheduled_posts
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- No policies for 'crew' or 'customer'. They cannot access this table.
