-- =============================================================================
-- Migration: 00013_phase1_quote_inventory_snapshot.sql
-- Description: Adds item_name snapshot to quote_inventory and an RPC for atomic save.
-- =============================================================================

-- 1. Add item_name for historical snapshotting
ALTER TABLE public.quote_inventory 
ADD COLUMN item_name text NOT NULL DEFAULT 'Unknown Item';

-- Remove the default now that existing rows (if any) are covered
ALTER TABLE public.quote_inventory 
ALTER COLUMN item_name DROP DEFAULT;

-- 2. Define custom type for inventory inputs
CREATE TYPE public.quote_inventory_input AS (
  inventory_item_id uuid,
  room text,
  quantity int,
  item_name text,
  volume numeric
);

-- 3. Atomic RPC for saving quote inventory
CREATE OR REPLACE FUNCTION public.save_quote_inventory(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_items public.quote_inventory_input[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Required to bypass RLS for internal transactional steps safely
AS $$
DECLARE
  v_quote_status public.quote_status;
  v_total_volume numeric := 0;
  v_item public.quote_inventory_input;
BEGIN
  -- Step 1: Verify mutability guard
  SELECT status INTO v_quote_status 
  FROM public.quotes 
  WHERE id = p_quote_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or invalid tenant context';
  END IF;

  IF v_quote_status != 'draft' THEN
    RAISE EXCEPTION 'Quote is no longer a draft and cannot be modified';
  END IF;

  -- Step 2: Delete existing inventory for this quote
  DELETE FROM public.quote_inventory 
  WHERE quote_id = p_quote_id AND tenant_id = p_tenant_id;

  -- Step 3: Insert new batch & compute total volume
  IF array_length(p_items, 1) > 0 THEN
    FOREACH v_item IN ARRAY p_items
    LOOP
      -- Calculate the volume for this row: quantity * base item volume
      -- Note: v_item.volume is expected to be the PER-ITEM base volume, 
      -- so we multiply by quantity for the row volume, and add to total.
      -- Wait, if v_item.volume is already quantity * base_volume, we just use it.
      -- To be absolutely safe and explicit, the UI will pass the base volume or total row volume.
      -- Let's define v_item.volume as the BASE volume from the catalog.
      -- Then row_volume = v_item.quantity * v_item.volume.
      
      INSERT INTO public.quote_inventory (
        tenant_id, quote_id, inventory_item_id, room, quantity, item_name, volume
      ) VALUES (
        p_tenant_id, 
        p_quote_id, 
        v_item.inventory_item_id, 
        v_item.room, 
        v_item.quantity, 
        v_item.item_name, 
        (v_item.quantity * v_item.volume)
      );

      v_total_volume := v_total_volume + (v_item.quantity * v_item.volume);
    END LOOP;
  END IF;

  -- Step 4: Update total_volume on the quote
  UPDATE public.quotes 
  SET total_volume = v_total_volume,
      updated_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id;

END;
$$;
