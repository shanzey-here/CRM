-- Migration: 20260831150000_allow_custom_stages_in_sync_trigger
-- Branch: feature/phase4-custom-column-create-ui
--
-- Drops NOT NULL on the legacy `stage` enum column and updates `leads_sync_stage_columns()`
-- to allow custom stages (where pipeline_stages.key is NULL).
-- For built-in stages with a key, `stage` continues to mirror the enum value.
-- For custom stages without a key, `stage` is set to NULL while `stage_id` holds the authoritative FK.

ALTER TABLE public.leads ALTER COLUMN stage DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.leads_sync_stage_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_key text;
  v_id  uuid;
  v_stage_exists boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.pipeline_stages
        WHERE id = NEW.stage_id AND tenant_id = NEW.tenant_id
      ), (
        SELECT key FROM public.pipeline_stages
        WHERE id = NEW.stage_id AND tenant_id = NEW.tenant_id
      ) INTO v_stage_exists, v_key;

      IF NOT v_stage_exists THEN
        RAISE EXCEPTION 'leads.stage_id % is not a pipeline_stages row for tenant %', NEW.stage_id, NEW.tenant_id;
      END IF;

      IF v_key IS NOT NULL THEN
        NEW.stage := v_key::public.lead_stage;
      ELSE
        NEW.stage := NULL;
      END IF;
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
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages
      WHERE id = NEW.stage_id AND tenant_id = NEW.tenant_id
    ), (
      SELECT key FROM public.pipeline_stages
      WHERE id = NEW.stage_id AND tenant_id = NEW.tenant_id
    ) INTO v_stage_exists, v_key;

    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'leads.stage_id % is not a pipeline_stages row for tenant %', NEW.stage_id, NEW.tenant_id;
    END IF;

    IF v_key IS NOT NULL THEN
      NEW.stage := v_key::public.lead_stage;
    ELSE
      NEW.stage := NULL;
    END IF;
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
