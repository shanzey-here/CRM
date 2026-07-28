BEGIN;

-- 1. Tighten RLS policies to tenant_admin only (as approved in plan)
DROP POLICY IF EXISTS admin_dispatcher_all ON automation_workflows;
CREATE POLICY admin_only ON automation_workflows
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'tenant_admin'
  );

DROP POLICY IF EXISTS admin_dispatcher_all ON automation_workflow_actions;
CREATE POLICY admin_only ON automation_workflow_actions
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'tenant_admin'
  );

DROP POLICY IF EXISTS admin_dispatcher_all ON automation_workflow_execution_log;
CREATE POLICY admin_only ON automation_workflow_execution_log
  FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'tenant_admin'
  );

-- 2. Create the transaction RPC for atomically saving a workflow + its actions
CREATE OR REPLACE FUNCTION save_workflow_transaction(
  p_tenant_id uuid,
  p_workflow_id uuid,
  p_name text,
  p_is_active boolean,
  p_trigger_event_type workflow_trigger_event_type,
  p_trigger_conditions jsonb,
  p_actions jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_workflow_id uuid;
  v_action jsonb;
BEGIN
  -- Insert or update the parent workflow
  IF p_workflow_id IS NULL THEN
    INSERT INTO automation_workflows (
      tenant_id, name, is_active, trigger_event_type, trigger_conditions
    ) VALUES (
      p_tenant_id, p_name, p_is_active, p_trigger_event_type, p_trigger_conditions
    )
    RETURNING id INTO v_workflow_id;
  ELSE
    UPDATE automation_workflows
    SET 
      name = p_name,
      is_active = p_is_active,
      trigger_event_type = p_trigger_event_type,
      trigger_conditions = p_trigger_conditions,
      updated_at = now()
    WHERE id = p_workflow_id AND tenant_id = p_tenant_id
    RETURNING id INTO v_workflow_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Workflow not found or access denied' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Clear existing actions for a clean rebuild (safe within the transaction)
  DELETE FROM automation_workflow_actions
  WHERE workflow_id = v_workflow_id AND tenant_id = p_tenant_id;

  -- Re-insert actions from the JSON payload
  IF jsonb_array_length(p_actions) > 0 THEN
    INSERT INTO automation_workflow_actions (
      tenant_id, workflow_id, action_type, action_config, sort_order
    )
    SELECT 
      p_tenant_id,
      v_workflow_id,
      (a->>'action_type')::workflow_action_type,
      (a->>'action_config')::jsonb,
      (a->>'sort_order')::integer
    FROM jsonb_array_elements(p_actions) AS a;
  END IF;

  RETURN jsonb_build_object('id', v_workflow_id);
END;
$$;

COMMIT;
