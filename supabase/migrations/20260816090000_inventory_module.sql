-- Migration: Inventory Module Updates

-- 1. Add columns to products
ALTER TABLE public.products
ADD COLUMN barcode TEXT,
ADD COLUMN unit TEXT DEFAULT 'pcs' NOT NULL,
ADD COLUMN min_stock NUMERIC(19,4) DEFAULT 0 NOT NULL,
ADD COLUMN supplier_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
ADD COLUMN image_url TEXT,
ADD COLUMN current_stock NUMERIC(19,4) DEFAULT 0 NOT NULL;

-- 2. Add columns to inventory_movements
ALTER TABLE public.inventory_movements
ADD COLUMN before_quantity NUMERIC(19,4) DEFAULT 0 NOT NULL,
ADD COLUMN after_quantity NUMERIC(19,4) DEFAULT 0 NOT NULL,
ADD COLUMN reason TEXT,
ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Create Trigger Function for Inventory Movements
-- This function locks the product row to ensure concurrent safety,
-- calculates the new stock based on the movement type,
-- sets before_quantity and after_quantity on the movement row,
-- and updates the cached current_stock on the product.

CREATE OR REPLACE FUNCTION public.set_inventory_movement_balances()
RETURNS trigger AS $$
DECLARE
  current_qty NUMERIC(19,4);
BEGIN
  -- Lock the product row to prevent race conditions
  SELECT current_stock INTO current_qty 
  FROM public.products 
  WHERE id = NEW.product_id 
  FOR UPDATE;
  
  -- Set before_quantity
  NEW.before_quantity = current_qty;
  
  -- Calculate after_quantity based on movement type
  IF NEW.type = 'in' THEN
    NEW.after_quantity = current_qty + NEW.quantity;
  ELSIF NEW.type = 'out' THEN
    NEW.after_quantity = current_qty - NEW.quantity;
  ELSIF NEW.type = 'adjustment' THEN
    NEW.after_quantity = current_qty + NEW.quantity; -- quantity can be negative for adjustments
  END IF;

  -- Update the cached stock on the product
  UPDATE public.products 
  SET current_stock = NEW.after_quantity 
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach Trigger to inventory_movements
CREATE TRIGGER trg_set_inventory_movement_balances
  BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_movement_balances();
