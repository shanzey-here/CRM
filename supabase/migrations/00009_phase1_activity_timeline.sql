-- =============================================================================
-- Migration: 00009_phase1_activity_timeline.sql
-- Description: Adds auto-logging mechanism for activities via domain events trigger.
-- =============================================================================

-- 1. Add idempotency column to activities
ALTER TABLE public.activities
ADD COLUMN source_event_id uuid REFERENCES public.domain_events(id) ON DELETE SET NULL UNIQUE;

-- 2. Create the unified helper function that can be called by both trigger and backfill
CREATE OR REPLACE FUNCTION public.process_domain_event_for_activities(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Needs to read contacts/leads across RLS
AS $$
DECLARE
  v_event public.domain_events%ROWTYPE;
  v_lead_id uuid;
  v_contact_id uuid;
  v_old_stage text;
  v_new_stage text;
  v_activity_type public.activity_type;
  v_content text;
BEGIN
  -- Fetch the event
  SELECT * INTO v_event FROM public.domain_events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- We only process specific lead events
  IF v_event.event_type IN ('lead.stage_changed', 'lead.updated', 'lead.created') THEN
    
    -- Extract lead_id
    v_lead_id := (v_event.payload->>'lead_id')::uuid;
    
    -- If no lead_id, we can't process it for the timeline
    IF v_lead_id IS NULL THEN
      RETURN;
    END IF;

    -- Fetch contact_id for the lead. Since SECURITY DEFINER is used, we have access.
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
      NULL, -- System generated
      v_event.id
    )
    ON CONFLICT (source_event_id) DO NOTHING;

    -- Mark event as processed safely
    UPDATE public.domain_events 
    SET processed_at = now() 
    WHERE id = v_event.id AND processed_at IS NULL;

  END IF;
END;
$$;

-- 3. Create the trigger function wrapper
CREATE OR REPLACE FUNCTION public.trg_process_domain_events_for_activities()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Offload to the shared helper
  PERFORM public.process_domain_event_for_activities(NEW.id);
  RETURN NEW;
END;
$$;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trg_activities_consume_events ON public.domain_events;
CREATE TRIGGER trg_activities_consume_events
AFTER INSERT ON public.domain_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_process_domain_events_for_activities();

-- 5. Backfill existing events idempotently
-- We loop through existing relevant events and process them using the exact same function.
DO $$
DECLARE
  v_event_id uuid;
BEGIN
  FOR v_event_id IN 
    SELECT id FROM public.domain_events 
    WHERE event_type IN ('lead.stage_changed', 'lead.updated', 'lead.created')
  LOOP
    PERFORM public.process_domain_event_for_activities(v_event_id);
  END LOOP;
END;
$$;
