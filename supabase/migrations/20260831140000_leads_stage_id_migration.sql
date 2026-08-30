-- Migration: 20260831140000_leads_stage_id_migration
-- Branch: feature/phase4-pipeline-stage-migration-execute
--
-- Migrates leads.stage off the fixed `lead_stage` enum onto a real FK to the
-- per-tenant pipeline_stages table (built + seeded by
-- 20260831120000_add_pipeline_stages_table.sql).
--
-- EXPAND phase of an expand/contract migration. Zero data loss is a hard
-- requirement: this migration REFUSES TO COMPLETE (RAISE EXCEPTION, whole
-- transaction rolls back) if the backfill is not a perfect 1:1 match for
-- every existing lead.
--
-- The old `stage` enum column is RETAINED, not dropped — see the header of
-- section 4. It becomes a mechanically-maintained mirror of stage_id (a
-- BEFORE trigger keeps the two consistent in both directions), so:
--   * every existing reader of leads.stage keeps working, unchanged, with no
--     inconsistency window — stage and stage_id are equal by construction;
--   * every existing writer of leads.stage (updateLeadStage, the workflow
--     engine, accept_quote_transaction, the AI-email paths) keeps working —
--     the trigger derives stage_id from it;
--   * stage_id is the authoritative column going forward; app code is moved
--     onto it, then `stage` is dropped in a dedicated follow-up branch.

-- =============================================================================
-- 1. Add the column (nullable for now) and backfill every existing lead.
-- =============================================================================
ALTER TABLE public.leads ADD COLUMN stage_id uuid;

-- Match on pipeline_stages.key (= the old enum value, added by the prior
-- branch specifically for this). Covers ALL 7 enum values, not just the 5
-- board-visible ones — a lead in `completed` or `archived` is backfilled the
-- same way.
UPDATE public.leads l
SET stage_id = ps.id
FROM public.pipeline_stages ps
WHERE ps.tenant_id = l.tenant_id
  AND ps.key = l.stage::text;

-- =============================================================================
-- 2. Verify the backfill COMPLETELY — every row, not a sample. Any gap or any
--    mismatch aborts the whole migration.
-- =============================================================================
DO $$
DECLARE
  v_total       bigint;
  v_null        bigint;
  v_mismatch    bigint;
BEGIN
  SELECT count(*) INTO v_total FROM public.leads;

  SELECT count(*) INTO v_null FROM public.leads WHERE stage_id IS NULL;

  -- Round-trip check: the freshly-set stage_id must resolve (via
  -- pipeline_stages.key, tenant-scoped) back to the exact enum value the old
  -- column still holds — for every single lead.
  SELECT count(*) INTO v_mismatch
  FROM public.leads l
  JOIN public.pipeline_stages ps ON ps.id = l.stage_id
  WHERE ps.tenant_id <> l.tenant_id
     OR ps.key IS DISTINCT FROM l.stage::text;

  RAISE NOTICE 'leads.stage_id backfill: % rows, % null, % mismatched', v_total, v_null, v_mismatch;

  IF v_null <> 0 OR v_mismatch <> 0 THEN
    RAISE EXCEPTION 'ABORT: stage_id backfill incomplete (% null, % mismatch of % leads) — no data will be migrated', v_null, v_mismatch, v_total;
  END IF;
END $$;

-- =============================================================================
-- 3. Lock it down: NOT NULL, the tenant-safe composite FK the prior branch
--    built pipeline_stages.UNIQUE(id, tenant_id) for, and a matching index.
-- =============================================================================
ALTER TABLE public.leads ALTER COLUMN stage_id SET NOT NULL;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_id_fkey
  FOREIGN KEY (stage_id, tenant_id)
  REFERENCES public.pipeline_stages (id, tenant_id);

CREATE INDEX idx_leads_tenant_stage_id ON public.leads (tenant_id, stage_id);

-- =============================================================================
-- 4. Keep `stage` and `stage_id` consistent — in BOTH directions — so there is
--    never a window where one is right and the other is stale, regardless of
--    which column a writer touches.
--
--    stage_id is authoritative: if a statement changes stage_id, `stage` is
--    re-derived from it. Legacy writers that still set the enum column get
--    stage_id derived from `stage`. A statement that sets both inconsistently
--    resolves in favour of stage_id.
--
--    Fires only when stage / stage_id are actually in the UPDATE's SET list
--    (BEFORE UPDATE OF ...), so unrelated lead updates pay nothing.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.leads_sync_stage_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_key text;
  v_id  uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NOT NULL THEN
      SELECT key INTO v_key FROM public.pipeline_stages
        WHERE id = NEW.stage_id AND tenant_id = NEW.tenant_id;
      IF v_key IS NULL THEN
        RAISE EXCEPTION 'leads.stage_id % is not a pipeline_stages row for tenant % (or its key is NULL)', NEW.stage_id, NEW.tenant_id;
      END IF;
      NEW.stage := v_key::public.lead_stage;
    ELSE
      SELECT id INTO v_id FROM public.pipeline_stages
        WHERE tenant_id = NEW.tenant_id AND key = NEW.stage::text;
      IF v_id IS NULL THEN
        RAISE EXCEPTION 'no pipeline_stages row with key % for tenant %', NEW.stage, NEW.tenant_id;
      END IF;
      NEW.stage_id := v_id;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT key INTO v_key FROM public.pipeline_stages
      WHERE id = NEW.stage_id AND tenant_id = NEW.tenant_id;
    IF v_key IS NULL THEN
      RAISE EXCEPTION 'leads.stage_id % is not a pipeline_stages row for tenant % (or its key is NULL)', NEW.stage_id, NEW.tenant_id;
    END IF;
    NEW.stage := v_key::public.lead_stage;
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage THEN
    SELECT id INTO v_id FROM public.pipeline_stages
      WHERE tenant_id = NEW.tenant_id AND key = NEW.stage::text;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'no pipeline_stages row with key % for tenant %', NEW.stage, NEW.tenant_id;
    END IF;
    NEW.stage_id := v_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_sync_stage_columns
  BEFORE INSERT OR UPDATE OF stage, stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_sync_stage_columns();

-- =============================================================================
-- 5. Stage-change Activity Timeline entries now render human-readable stage
--    NAMES ("Moved from Quote Sent to Follow Up") instead of raw enum keys
--    ("Moved from quote_sent to follow_up").
--
--    The event payload is unchanged (still {old_stage, new_stage} as keys —
--    machine-stable); only the display string this function builds changes.
--    Falls back to the raw key, then 'none', so historical events and any
--    non-pipeline value still render.
--
--    Whole function reproduced verbatim from its live definition with only the
--    v_content line for 'lead.stage_changed' changed.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_domain_event_for_activities(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  SELECT * INTO v_event FROM public.domain_events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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
      v_content := 'Moved from '
        || COALESCE(
             (SELECT name FROM public.pipeline_stages WHERE tenant_id = v_event.tenant_id AND key = v_old_stage),
             v_old_stage, 'none')
        || ' to '
        || COALESCE(
             (SELECT name FROM public.pipeline_stages WHERE tenant_id = v_event.tenant_id AND key = v_new_stage),
             v_new_stage);
    ELSIF v_event.event_type = 'lead.updated' THEN
      v_activity_type := 'system';

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

    INSERT INTO public.activities (
      tenant_id,
      contact_id,
      lead_id,
      type,
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
      NULL
    ) ON CONFLICT (source_event_id) DO NOTHING;

    UPDATE public.domain_events
    SET processed_at = now()
    WHERE id = v_event.id AND processed_at IS NULL;

  ELSIF v_event.event_type = 'task.completed' THEN

    v_task_id := (v_event.payload->>'task_id')::uuid;

    IF v_task_id IS NULL THEN
      RETURN;
    END IF;

    SELECT contact_id, lead_id, title INTO v_contact_id, v_lead_id, v_task_title
    FROM public.tasks
    WHERE id = v_task_id AND tenant_id = v_event.tenant_id;

    IF v_contact_id IS NULL AND v_lead_id IS NULL THEN
      UPDATE public.domain_events
      SET processed_at = now()
      WHERE id = v_event.id AND processed_at IS NULL;
      RETURN;
    END IF;

    v_activity_type := 'system';
    v_content := 'Task completed: ' || v_task_title;

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
$function$;
