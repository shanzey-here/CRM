BEGIN;

-- 1. ENUMs
CREATE TYPE workflow_trigger_event_type AS ENUM (
  'lead.created',
  'lead.stage_changed',
  'lead.updated',
  'task.completed',
  'email.received'
);

CREATE TYPE workflow_action_type AS ENUM (
  'create_task',
  'update_lead_stage'
);

CREATE TYPE workflow_execution_status AS ENUM (
  'pending',
  'success',
  'partial',
  'failed'
);

-- 2. automation_workflows
CREATE TABLE automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  trigger_event_type workflow_trigger_event_type NOT NULL,
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_workflows_tenant ON automation_workflows(tenant_id);

ALTER TABLE automation_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_dispatcher_all ON automation_workflows
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- 3. automation_workflow_actions
CREATE TABLE automation_workflow_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  action_type workflow_action_type NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Validation: update_lead_stage must have a valid stage matching lead_stage ENUM
  CONSTRAINT valid_update_lead_stage CHECK (
    action_type != 'update_lead_stage' 
    OR (action_config->>'stage' IN ('inquiry', 'survey_scheduled', 'quote_sent', 'follow_up', 'confirmed_booking', 'completed', 'archived'))
  )
);

CREATE INDEX idx_automation_workflow_actions_workflow ON automation_workflow_actions(workflow_id);
CREATE INDEX idx_automation_workflow_actions_tenant ON automation_workflow_actions(tenant_id);

ALTER TABLE automation_workflow_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_dispatcher_all ON automation_workflow_actions
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- 4. automation_workflow_execution_log
CREATE TABLE automation_workflow_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  status workflow_execution_status NOT NULL,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_workflow_execution_log_workflow ON automation_workflow_execution_log(workflow_id);
CREATE INDEX idx_automation_workflow_execution_log_tenant ON automation_workflow_execution_log(tenant_id);
CREATE INDEX idx_automation_workflow_execution_log_event ON automation_workflow_execution_log(event_id);

ALTER TABLE automation_workflow_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_dispatcher_all ON automation_workflow_execution_log
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

COMMIT;
