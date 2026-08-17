-- =============================================================
-- Migration: Sprint 3 - Performance Indexes (PERF-01)
-- Adds missing FK and high-cardinality indexes that were absent
-- from earlier migrations. All use IF NOT EXISTS so they are safe
-- to run multiple times.
-- =============================================================

-- ── transactions ─────────────────────────────────────────────
-- FK: transactions.branch_id
CREATE INDEX IF NOT EXISTS idx_transactions_branch
  ON public.transactions(branch_id);

-- FK: transactions.party_id (party statement queries)
CREATE INDEX IF NOT EXISTS idx_transactions_party
  ON public.transactions(party_id)
  WHERE party_id IS NOT NULL;

-- FK: transactions.created_by
CREATE INDEX IF NOT EXISTS idx_transactions_created_by
  ON public.transactions(created_by)
  WHERE created_by IS NOT NULL;

-- Composite for the reports engine (business + state + date)
CREATE INDEX IF NOT EXISTS idx_transactions_biz_state_date
  ON public.transactions(business_id, state, transaction_date);

-- ── transaction_items ─────────────────────────────────────────
-- FK: transaction_items.transaction_id (most JOIN hot-path)
CREATE INDEX IF NOT EXISTS idx_txn_items_transaction
  ON public.transaction_items(transaction_id);

-- FK: transaction_items.product_id (COGS calculations)
CREATE INDEX IF NOT EXISTS idx_txn_items_product
  ON public.transaction_items(product_id);

-- ── account_transactions ──────────────────────────────────────
-- FK: account_transactions.transaction_id
CREATE INDEX IF NOT EXISTS idx_acc_txn_transaction
  ON public.account_transactions(transaction_id);

-- ── products ──────────────────────────────────────────────────
-- FK: products.category_id
CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products(category_id)
  WHERE category_id IS NOT NULL;

-- FK: products.supplier_id
CREATE INDEX IF NOT EXISTS idx_products_supplier
  ON public.products(supplier_id)
  WHERE supplier_id IS NOT NULL;

-- Low-stock query: business + stock vs min_stock
CREATE INDEX IF NOT EXISTS idx_products_biz_stock_min
  ON public.products(business_id, current_stock, min_stock)
  WHERE deleted_at IS NULL;

-- ── inventory_movements ───────────────────────────────────────
-- FK: inventory_movements.branch_id
CREATE INDEX IF NOT EXISTS idx_inventory_branch
  ON public.inventory_movements(branch_id);

-- FK: inventory_movements.transaction_id (reversal lookups)
CREATE INDEX IF NOT EXISTS idx_inventory_transaction
  ON public.inventory_movements(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ── parties ───────────────────────────────────────────────────
-- Phone lookups (add_staff_by_phone RPC)
CREATE INDEX IF NOT EXISTS idx_parties_phone_biz
  ON public.parties(business_id, phone)
  WHERE deleted_at IS NULL;

-- ── invoices ──────────────────────────────────────────────────
-- FK: invoices.business_id + status (billing dashboard)
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status
  ON public.invoices(business_id, status);

-- Gateway invoice ID for webhook lookup (FIN-03)
CREATE INDEX IF NOT EXISTS idx_invoices_gateway_id
  ON public.invoices(uddoktapay_invoice_id)
  WHERE uddoktapay_invoice_id IS NOT NULL;

-- ── subscriptions ─────────────────────────────────────────────
-- FK: subscriptions.business_id + status (entitlement engine, very hot)
CREATE INDEX IF NOT EXISTS idx_subscriptions_biz_status
  ON public.subscriptions(business_id, status);

-- ── business_members ──────────────────────────────────────────
-- FK: business_members.user_id (auth hot-path)
CREATE INDEX IF NOT EXISTS idx_biz_members_user
  ON public.business_members(user_id);

-- ── daily_closings ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_closings_biz_date
  ON public.daily_closings(business_id, closing_date);

-- ── usage_records ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usage_records_biz_feature
  ON public.usage_records(business_id, feature_key, period_start);
