-- WARNING: KEEP IN SYNC!
-- This trigger logic must exactly match the CRATE_STATUS_TRANSITIONS map defined in:
-- src/modules/storage/transitions.ts
-- If you update this DB trigger, you MUST update the TypeScript map and vice versa.
-- There is an anti-drift test in scripts/test-crate-transitions.ts to enforce this.

CREATE OR REPLACE FUNCTION enforce_crate_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  -- If status hasn't changed, allow it
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate transitions
  IF OLD.status = 'in_warehouse' THEN
    IF NEW.status NOT IN ('reserved', 'with_customer') THEN
      RAISE EXCEPTION 'Invalid crate status transition from in_warehouse to %', NEW.status;
    END IF;
  ELSIF OLD.status = 'reserved' THEN
    IF NEW.status NOT IN ('with_customer', 'in_warehouse') THEN
      RAISE EXCEPTION 'Invalid crate status transition from reserved to %', NEW.status;
    END IF;
  ELSIF OLD.status = 'with_customer' THEN
    IF NEW.status NOT IN ('returned', 'lost', 'damaged') THEN
      RAISE EXCEPTION 'Invalid crate status transition from with_customer to %', NEW.status;
    END IF;
  ELSIF OLD.status = 'returned' THEN
    IF NEW.status NOT IN ('in_warehouse', 'reserved', 'with_customer') THEN
      RAISE EXCEPTION 'Invalid crate status transition from returned to %', NEW.status;
    END IF;
  ELSIF OLD.status = 'lost' THEN
    -- In TS, lost is [] (terminal). If we strictly match TS, we raise exception.
    -- The UI's "allowOverride" feature allows overriding this, but without an RPC,
    -- a basic DB trigger will block it. For now, we enforce the strict map.
    RAISE EXCEPTION 'Invalid crate status transition from lost to %', NEW.status;
  ELSIF OLD.status = 'damaged' THEN
    RAISE EXCEPTION 'Invalid crate status transition from damaged to %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_crate_status_transitions ON crates;
CREATE TRIGGER trg_enforce_crate_status_transitions
BEFORE UPDATE ON crates
FOR EACH ROW
EXECUTE FUNCTION enforce_crate_status_transitions();
