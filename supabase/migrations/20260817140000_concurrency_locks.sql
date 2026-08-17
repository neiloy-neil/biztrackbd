-- Migration: Add Negative Stock Prevention (Concurrency Locks)

CREATE OR REPLACE FUNCTION public.set_inventory_movement_balances()
RETURNS trigger AS $$
DECLARE
  current_qty NUMERIC(19,4);
  prod_name TEXT;
BEGIN
  -- Lock the product row to prevent race conditions
  SELECT current_stock, name INTO current_qty, prod_name
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

  -- Prevent negative stock
  IF NEW.after_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product: % (Current: %)', prod_name, current_qty;
  END IF;

  -- Update the cached stock on the product
  UPDATE public.products 
  SET current_stock = NEW.after_quantity 
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
