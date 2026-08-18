# Financial Architecture Fix Plan (P0 & P1)

## Goal Description
The objective is to fix the critical financial calculation and architectural issues uncovered during the forensic audit without redesigning the core schema. We will fix the Customer/Supplier due inflation, enable atomic account transfers, and correct the daily profit calculation.

## Proposed Changes

### Database Migrations

#### [NEW] `d:\AI\biztrackbd\supabase\migrations\20260818010000_financial_p0_p1_fixes.sql`
- **Fix `v_party_balances` (P0)**: Rewrite the view to correctly aggregate point-of-sale partial/full payments. The new logic will take the `SUM(transactions.total_amount)` for sales/purchases and subtract/add the corresponding sum of `account_transactions.amount` for those same transactions.
- **Fix Profit Calculation (P1)**: Update `get_daily_closing_summary` to calculate `v_total_cogs` by joining `transaction_items` against `products.cost`. Update the formula to `v_total_profit := (v_total_sales - v_total_cogs) + v_total_income - v_total_expenses`.
- **Implement Atomic Transfers (P0)**: Create a new RPC `create_transfer_atomic` that takes `p_source_account_id` and `p_dest_account_id`, creating a single `transactions` row (type='transfer') and two `account_transactions` rows (one debit, one credit) atomically.

### Backend Actions

#### [MODIFY] `d:\AI\biztrackbd\src\domains\transactions\actions.ts`
- Implement `createTransfer` server action to interface with the new `create_transfer_atomic` RPC. 
- Ensure RBAC and tenant isolation are enforced in the action (similar to `createTransaction`).

## Verification Plan

### Automated Tests
1. We will create a robust automated test suite using Jest/TS script to run the exact simulation documented in `FINANCIAL-SCENARIO-VALIDATION.md` against a fresh test business.
2. The script will assert the real-time balances, expected cash, and daily closing summary.

### Manual Verification
1. Verify TypeScript compilation (`npm run typecheck`).
2. Verify linter (`npm run lint`).
3. Apply migration locally and verify it executes without error.
