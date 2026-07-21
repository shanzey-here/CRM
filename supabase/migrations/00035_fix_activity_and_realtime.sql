-- =============================================================================
-- Migration: 00035_fix_activity_and_realtime.sql
-- Description: Fixes the column name in activity triggers, restores task events, and enables realtime for leads.
-- =============================================================================

-- 1. Fix realtime publication for leads table
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    END IF;
  END
  $$;
COMMIT;

-- 2. Fix the domain events trigger function to use 'type' instead of 'activity_type' and restore task.completed logic
CREATE OR REPLACE FUNCTION public.process_domain_event_for_activities(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.domain_events%ROWTYPE;
  v_lead_id uuid;
  v_contact_id uuid;
  v_old_stage text;
  v_new_stage text;
  v_activity_type public.activity_type;
  v_content text;
  v_changes jsonb;
  v_changes_text text;
  
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
    
    -- Extract lead_id
    v_lead_id := (v_event.payload->>'lead_id')::uuid;
    
    -- If no lead_id, we can't process it for the timeline
    IF v_lead_id IS NULL THEN
      RETURN;
    END IF;

    -- Fetch contact_id for the lead
    SELECT contact_id INTO v_contact_id 
    FROM public.leads 
    WHERE id = v_lead_id AND tenant_id = v_event.tenant_id;

    IF v_contact_id IS NULL THEN
      RETURN; -- Lead might have been deleted, or invalid tenant
    END IF;

    -- Determine activity type and content
    IF v_event.event_type = 'lead.stage_changed' THEN
      v_old_stage := v_event.payload->>'old_stage';
      v_new_stage := v_event.payload->>'new_stage';
      v_activity_type := 'stage_change';
      v_content := 'Moved from ' || COALESCE(v_old_stage, 'none') || ' to ' || v_new_stage;
    ELSIF v_event.event_type = 'lead.updated' THEN
      v_activity_type := 'system';
      
      -- Extract detailed changes if provided
      v_changes := v_event.payload->'changes';
      
      IF jsonb_typeof(v_changes) = 'array' AND jsonb_array_length(v_changes) > 0 THEN
        SELECT string_agg(value->>0, '. ') INTO v_changes_text FROM jsonb_array_elements(v_changes) AS value;
        v_content := 'Lead details updated: ' || v_changes_text || '.';
      ELSE
        v_content := 'Lead details were updated.';
      END IF;
      
    ELSIF v_event.event_type = 'lead.created' THEN
      v_activity_type := 'system';
      v_content := 'Lead was created.';
    END IF;

    -- Insert the activity using the correct column name 'type'
    INSERT INTO public.activities (
      tenant_id,
      contact_id,
      lead_id,
      type, -- CORRECTED: was activity_type in 00012
      content,
      metadata,
      source_event_id,
      created_by
    ) VALUES (
      v_event.tenant_id,
      v_contact_id,
      v_lead_id,
      v_activity_type,
      v_content,
      jsonb_build_object('lead_id', v_lead_id),
      v_event.id,
      NULL -- System generated from event
    ) ON CONFLICT (source_event_id) DO NOTHING; -- Idempotency check

    UPDATE public.domain_events 
    SET processed_at = now() 
    WHERE id = v_event.id AND processed_at IS NULL;

  -- 2. Process specific task events (Restored from 00010)
  ELSIF v_event.event_type = 'task.completed' THEN
    
    v_task_id := (v_event.payload->>'task_id')::uuid;

    IF v_task_id IS NULL THEN
      RETURN;
    END IF;

    -- Fetch task details
    SELECT contact_id, lead_id, title INTO v_contact_id, v_lead_id, v_task_title
    FROM public.tasks
    WHERE id = v_task_id AND tenant_id = v_event.tenant_id;

    -- Must have contact or lead to link timeline
    IF v_contact_id IS NULL AND v_lead_id IS NULL THEN
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
      metadata,
      created_by,
      source_event_id
    ) VALUES (
      v_event.tenant_id,
      v_contact_id,
      v_lead_id,
      v_activity_type,
      v_content,
      jsonb_build_object('task_id', v_task_id),
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
