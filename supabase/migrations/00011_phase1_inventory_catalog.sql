-- ==============================================================================
-- PHASE 1: INVENTORY CATALOG REFINEMENT
-- ==============================================================================

-- 1. Enforce strictly positive default_volume to prevent calculation corruption
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_default_volume_check 
  CHECK (default_volume > 0);

-- 2. Constrain room to a predefined enum to ensure groupability for quotes
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_room_check 
  CHECK (
    room IS NULL OR 
    room IN (
      'bedroom', 
      'living_room', 
      'dining_room', 
      'kitchen', 
      'bathroom', 
      'office', 
      'garage', 
      'outdoor', 
      'other'
    )
  );

-- Note: Phase 1.5 will introduce an onboarding workflow to pre-seed this 
-- catalog for new tenants so it isn't empty on day 1.
