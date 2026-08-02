-- Real bug found while testing feature/phase2-crew-signoff: jobs only has
-- crew_select (SELECT-only) for the 'crew' role — there is no UPDATE policy
-- at all for crew. addJobSignoffAction's final step
-- (UPDATE jobs SET status = 'completed' ...) runs on the crew member's own
-- RLS-scoped session (not service-role), so it was being silently blocked
-- by RLS: Postgres/PostgREST reports success with zero rows affected, which
-- surfaces as no error at all — the action returned { success: true } while
-- jobs.status never actually changed. Confirmed directly: 5 real
-- job_signoffs rows existed in the database (the insert succeeded every
-- time, correctly gated by its own crew-assignment INSERT policy from
-- 00072), but the linked job's status remained 'scheduled' throughout.
--
-- Fix: a narrowly-scoped UPDATE policy — a crew member may only transition
-- a job's status to 'completed' (WITH CHECK), and only for a job they are
-- actually assigned to (same assignment-membership check as crew_select),
-- mirroring the crew-assignment enforcement already proven correct on
-- job_signoffs' own INSERT policy. This is not a general "crew can edit
-- jobs" grant — it exists solely to make the sign-off flow's one real
-- server-side write actually work.

CREATE POLICY crew_update_status ON jobs FOR UPDATE
  USING (
    public.current_user_role() = 'crew'
    AND tenant_id = public.current_tenant_id()
    AND id IN (
      SELECT job_id FROM job_crew_assignments
      WHERE user_id = auth.uid()
        AND tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'crew'
    AND tenant_id = public.current_tenant_id()
    AND status = 'completed'
    AND id IN (
      SELECT job_id FROM job_crew_assignments
      WHERE user_id = auth.uid()
        AND tenant_id = public.current_tenant_id()
    )
  );
