-- Platform Health / System Health tab: no cron route currently writes its
-- outcome anywhere durable (confirmed by reading all 5 real cron routes —
-- results only go into the HTTP response, failures at best hit
-- console.error into Vercel's short-retention logs). This table is the
-- single shared destination every cron route writes to, one row per run.
CREATE TABLE public.cron_run_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      text NOT NULL, -- matches the route path, e.g. 'trials/expire'
  started_at    timestamptz NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL CHECK (status IN ('success', 'failure')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cron_run_log_job_name_completed_at
  ON public.cron_run_log(job_name, completed_at DESC);

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;

-- Super admin read-only — matches every other platform-wide table's RLS
-- shape (platform_mrr_snapshots, audit.logs). Writes only ever come from
-- the cron routes' service_role client, which bypasses RLS entirely, so no
-- INSERT/UPDATE/DELETE policy exists for any client role.
CREATE POLICY "super_admin_select_cron_run_log"
  ON public.cron_run_log
  FOR SELECT
  USING (public.is_super_admin() = true);
