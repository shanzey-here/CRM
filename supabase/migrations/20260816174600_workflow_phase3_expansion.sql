-- 1. Extend enums for workflow triggers
ALTER TYPE workflow_trigger_event_type ADD VALUE IF NOT EXISTS 'quote.sent';
ALTER TYPE workflow_trigger_event_type ADD VALUE IF NOT EXISTS 'quote.accepted';
ALTER TYPE workflow_trigger_event_type ADD VALUE IF NOT EXISTS 'job.completed';
ALTER TYPE workflow_trigger_event_type ADD VALUE IF NOT EXISTS 'invoice.paid';

-- 2. Extend enums for workflow actions
ALTER TYPE workflow_action_type ADD VALUE IF NOT EXISTS 'delay';
ALTER TYPE workflow_action_type ADD VALUE IF NOT EXISTS 'send_email';
ALTER TYPE workflow_action_type ADD VALUE IF NOT EXISTS 'send_sms';
ALTER TYPE workflow_action_type ADD VALUE IF NOT EXISTS 'notify_staff';
ALTER TYPE workflow_action_type ADD VALUE IF NOT EXISTS 'condition';

-- 3. Create automation_workflow_pending_steps table
CREATE TABLE automation_workflow_pending_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  execution_log_id uuid NOT NULL REFERENCES automation_workflow_execution_log(id) ON DELETE CASCADE,
  next_action_sort_order integer NOT NULL,
  resume_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_workflow_pending_steps_tenant ON automation_workflow_pending_steps(tenant_id);
CREATE INDEX idx_automation_workflow_pending_steps_resume ON automation_workflow_pending_steps(resume_at);

ALTER TABLE automation_workflow_pending_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_dispatcher_all ON automation_workflow_pending_steps
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );
