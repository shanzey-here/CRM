-- =============================================================================
-- Migration: 00010_phase1_tasks_events.sql
-- Description: Update process_domain_event_for_activities to consume task.completed
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_domain_event_for_activities(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Needs to read contacts/leads/tasks across RLS
AS $$
DECLARE
  v_event public.domain_events%ROWTYPE;
  v_lead_id uuid;
  v_contact_id uuid;
  v_old_stage text;
  v_new_stage text;
  v_activity_type public.activity_type;
  v_content text;
  
  -- Task vars
  v_task_id uuid;
  v_task_title text;
BEGIN
  -- Fetch the event
  SELECT * INTO v_event FROM public.domain_events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 1. Process specific lead events
  IF v_event.event_type IN ('lead.stage_changed', 'lead.updated', 'lead.created') THEN
    
    v_lead_id := (v_event.payload->>'lead_id')::uuid;
    
    IF v_lead_id IS NULL THEN
      RETURN;
    END IF;

    SELECT contact_id INTO v_contact_id 
    FROM public.leads 
    WHERE id = v_lead_id AND tenant_id = v_event.tenant_id;

    IF v_contact_id IS NULL THEN
      RETURN; 
    END IF;

    IF v_event.event_type = 'lead.stage_changed' THEN
      v_old_stage := v_event.payload->>'old_stage';
      v_new_stage := v_event.payload->>'new_stage';
      v_activity_type := 'stage_change';
      v_content := 'Moved from ' || COALESCE(v_old_stage, 'none') || ' to ' || v_new_stage;
    ELSIF v_event.event_type = 'lead.updated' THEN
      v_activity_type := 'system';
      v_content := 'Lead details were updated.';
    ELSIF v_event.event_type = 'lead.created' THEN
      v_activity_type := 'system';
      v_content := 'Lead was created.';
    END IF;

    -- Insert the activity idempotently
    INSERT INTO public.activities (
      tenant_id,
      contact_id,
      lead_id,
      type,
      content,
      created_by,
      source_event_id
    ) VALUES (
      v_event.tenant_id,
      v_contact_id,
      v_lead_id,
      v_activity_type,
      v_content,
      NULL,
      v_event.id
    )
    ON CONFLICT (source_event_id) DO NOTHING;

    UPDATE public.domain_events 
    SET processed_at = now() 
    WHERE id = v_event.id AND processed_at IS NULL;

  -- 2. Process specific task events
  ELSIF v_event.event_type = 'task.completed' THEN
    
    v_task_id := (v_event.payload->>'task_id')::uuid;

    IF v_task_id IS NULL THEN
      RETURN;
    END IF;

    -- Fetch task details
    SELECT contact_id, lead_id, title INTO v_contact_id, v_lead_id, v_task_title
    FROM public.tasks
    WHERE id = v_task_id AND tenant_id = v_event.tenant_id;

    -- A task might not be linked to a contact/lead (global task), but our timeline UI needs contact/lead.
    -- If neither, we still log it if the schema allows NULL for both?
    -- No, schema has constraint: chk_activity_has_target CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL)
    IF v_contact_id IS NULL AND v_lead_id IS NULL THEN
      -- Mark as processed and exit, since we can't log it to a specific record's timeline
      UPDATE public.domain_events 
      SET processed_at = now() 
      WHERE id = v_event.id AND processed_at IS NULL;
      RETURN;
    END IF;

    v_activity_type := 'system';
    v_content := 'Task completed: ' || v_task_title;

    -- Insert the activity idempotently
    INSERT INTO public.activities (
      tenant_id,
      contact_id,
      lead_id,
      type,
      content,
      created_by,
      source_event_id
    ) VALUES (
      v_event.tenant_id,
      v_contact_id,
      v_lead_id,
      v_activity_type,
      v_content,
      NULL, 
      v_event.id
    )
    ON CONFLICT (source_event_id) DO NOTHING;

    UPDATE public.domain_events 
    SET processed_at = now() 
    WHERE id = v_event.id AND processed_at IS NULL;

  END IF;
END;
$$;
