-- Migration: Extended Inventory Architecture (Variants, Batches, Serialization)

-- 1. Tracking Type Enum
CREATE TYPE public.inventory_tracking_type AS ENUM ('simple', 'variant', 'batch', 'serialized');

-- Add tracking type to products (default 'simple' to maintain compatibility)
ALTER TABLE public.products 
ADD COLUMN tracking_type public.inventory_tracking_type NOT NULL DEFAULT 'simple';

-- 2. Product Variants (Level 1)
-- Handles Fashion (Size/Color), Grocery Units, Wholesale Cartons
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  sku text,
  name_override text,
  attributes jsonb DEFAULT '{}'::jsonb NOT NULL, -- e.g., {"size": "XL", "color": "Red"}
  price_override numeric(19,4),
  cost_override numeric(19,4),
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  UNIQUE(product_id, sku)
);

CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variants_read" ON public.product_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.business_id = public.get_current_business_id())
);

-- 3. Inventory Lots / Instances (Level 2 & 3)
-- Handles Batches, Expiries, Serial Numbers, IMEIs
CREATE TABLE public.inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  identifier text NOT NULL, -- Batch No, Serial No, or IMEI
  expiry_date date,
  status text DEFAULT 'in_stock' NOT NULL, -- 'in_stock', 'sold', 'returned'
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(product_id, identifier)
);

CREATE INDEX idx_inventory_lots_product ON public.inventory_lots(product_id);

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_lots_read" ON public.inventory_lots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory_lots.product_id AND p.business_id = public.get_current_business_id())
);

-- 4. Extend Transaction Items
ALTER TABLE public.transaction_items 
ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
ADD COLUMN lot_id uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL,
ADD COLUMN attributes jsonb; -- Snapshot of the variant/lot attributes at time of sale

-- 5. Extend Inventory Movements
ALTER TABLE public.inventory_movements
ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
ADD COLUMN lot_id uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL;

-- 6. Update process_pos_sale to handle variants and lots
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_business_id UUID,
  p_branch_id UUID,
  p_party_id UUID, 
  p_total_amount NUMERIC,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_notes TEXT,
  p_user_id UUID,
  p_items JSONB, 
  p_payments JSONB 
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item RECORD;
  v_payment RECORD;
  v_calc_subtotal NUMERIC := 0;
  v_calc_total NUMERIC := 0;
  v_db_price NUMERIC;
  v_total_paid NUMERIC := 0;
  v_due_delta NUMERIC := 0;
  v_variant_price NUMERIC;
  v_tracking_type public.inventory_tracking_type;
BEGIN
  IF p_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  -- 1. Server-side price calculation
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, lot_id UUID, quantity NUMERIC) LOOP
    SELECT price, tracking_type INTO v_db_price, v_tracking_type 
    FROM public.products 
    WHERE id = v_item.product_id AND business_id = p_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or does not belong to business', v_item.product_id;
    END IF;

    IF v_item.variant_id IS NOT NULL THEN
      SELECT price_override INTO v_variant_price FROM public.product_variants WHERE id = v_item.variant_id AND product_id = v_item.product_id;
      IF v_variant_price IS NOT NULL THEN
        v_db_price := v_variant_price;
      END IF;
    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_db_price * v_item.quantity);
  END LOOP;

  v_calc_total := v_calc_subtotal - p_discount;

  -- 2. Insert transaction using calculated totals
  INSERT INTO public.transactions (
    business_id, branch_id, party_id, type, state, 
    total_amount, subtotal, discount, notes, created_by
  ) VALUES (
    p_business_id, p_branch_id, p_party_id, 'sale', 'completed',
    v_calc_total, v_calc_subtotal, p_discount, p_notes, p_user_id
  ) RETURNING id INTO v_transaction_id;

  -- 3. Process items using database prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, lot_id UUID, quantity NUMERIC) LOOP
    SELECT price INTO v_db_price FROM public.products WHERE id = v_item.product_id;

    IF v_item.variant_id IS NOT NULL THEN
      SELECT price_override INTO v_variant_price FROM public.product_variants WHERE id = v_item.variant_id AND product_id = v_item.product_id;
      IF v_variant_price IS NOT NULL THEN
        v_db_price := v_variant_price;
      END IF;
    END IF;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, variant_id, lot_id, quantity, unit_price, subtotal
    ) VALUES (
      v_transaction_id, v_item.product_id, v_item.variant_id, v_item.lot_id, v_item.quantity, v_db_price, (v_db_price * v_item.quantity)
    );

    INSERT INTO public.inventory_movements (
      business_id, branch_id, product_id, variant_id, lot_id, transaction_id, type, quantity, created_by
    ) VALUES (
      p_business_id, p_branch_id, v_item.product_id, v_item.variant_id, v_item.lot_id, v_transaction_id, 'out', v_item.quantity, p_user_id
    );

    IF v_item.lot_id IS NOT NULL THEN
      -- If it's a serialized item and we sold it, mark it sold
      -- (Assuming quantity 1 for serialized, but safe to just update status)
      UPDATE public.inventory_lots SET status = 'sold' WHERE id = v_item.lot_id AND EXISTS (SELECT 1 FROM public.products WHERE id = v_item.product_id AND tracking_type = 'serialized');
    END IF;
  END LOOP;

  -- 4. Process payments
  FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(account_id UUID, amount NUMERIC) LOOP
    IF v_payment.amount > 0 THEN
      INSERT INTO public.account_transactions (
        transaction_id, account_id, amount
      ) VALUES (
        v_transaction_id, v_payment.account_id, v_payment.amount
      );
      v_total_paid := v_total_paid + v_payment.amount;
    END IF;
  END LOOP;

  -- 5. Calculate and update current_due if there's a party
  IF p_party_id IS NOT NULL THEN
    v_due_delta := v_calc_total - v_total_paid;
    
    IF v_due_delta > 0 THEN
      UPDATE public.parties 
      SET 
        current_due = current_due + v_due_delta, 
        updated_at = now() 
      WHERE id = p_party_id;
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
