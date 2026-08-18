# Transaction Type Full Audit Report

## Executive Summary
This document audits the complete lifecycle for every transaction type referenced in the BizTrack BD system. 
**Key Finding:** The underlying Postgres data model (`ddd_schema.sql`) explicitly defines an expansive `transaction_type` enum (`'sale', 'purchase', 'expense', 'income', 'transfer', 'payment_in', 'payment_out', 'opening_balance'`). However, the Next.js API layer only implements a subset of these features, leaving several core accounting functions unimplemented or broken.

---

## 1. Sale
- **UI Flow:** POS Module -> Add to Cart -> Checkout.
- **Server Action:** `processPOSSale` (`pos/actions.ts`). Protected by `idempotentAction` preventing duplicate submissions.
- **Validation:** Verifies `sales.create` RBAC permission.
- **PostgreSQL:** Calls `process_pos_sale` RPC. Implicit PL/pgSQL transaction guarantees atomic inserts. No partial writes possible.
- **Account Ledger:** Account transactions inserted correctly. Validates account belongs to the business.
- **Party Balance:** Trigger `trg_maintain_party_balance` correctly increases `current_due` based on total amount vs payment.
- **Inventory:** Inserts `out` movements to `inventory_movements` and dynamically decreases `current_stock`.
- **Dashboard & Reports:** Summarized under `total_sales`.
- **Audit Logs:** **Missing.** The transaction is not recorded in the `audit_logs` system.

## 2. Purchase
- **Status:** **NOT IMPLEMENTED**
- **Details:** Although `purchase` exists in the database enum and the `trg_maintain_party_balance` trigger supports updating supplier dues for `purchase`, there is no `createPurchase` Server Action in the codebase, nor is it exposed in the UI.

## 3. Income
- **Status:** **NOT IMPLEMENTED / BUG**
- **Details:** The DB enum contains `income`. The `create_transaction_atomic` RPC supports `income`. However, the Server Action `createTransaction` rigidly checks types against `'sale' | 'expense' | 'payment_in' | 'payment_out'`, ignoring pure `income`. Consequently, the Dashboard's profit calculation explicitly ignores income entirely.

## 4. Expense
- **UI Flow:** Transactions -> Add Expense.
- **Server Action:** `createTransaction` (`transactions/actions.ts`). Idempotent.
- **Validation:** Verifies `expenses.create`.
- **PostgreSQL:** Calls `create_transaction_atomic` RPC. Atomic, no partial writes.
- **Account Ledger:** Correctly inserts an `account_transaction` with a negative amount (`-p_total_amount`) decreasing cash flow.
- **Party Balance:** **BROKEN.** The database trigger `trg_maintain_party_balance` checks if `NEW.type IN ('purchase', 'opening_balance')` for suppliers. It completely ignores `expense`. Thus, creating an expense against a supplier fails to update their ledger due balance.
- **Dashboard & Reports:** Summarized accurately under `total_expenses`.
- **Audit Logs:** Missing.

## 5. Payment In & Payment Out
- **UI Flow:** Transactions -> Add Income / Expense.
- **Server Action:** `createTransaction`. Idempotent.
- **Validation:** Checks `sales.create` for `payment_in` and `expenses.create` for `payment_out`.
- **Account Ledger:** Handled atomically.
- **Party Balance:** Handled correctly by DB trigger (`payment_in` decreases customer due, `payment_out` decreases supplier due).

## 6. Transfer
- **Status:** **NOT IMPLEMENTED**
- **Details:** `transfer` exists in the `transaction_type` enum but there is no Server Action supporting moving cash from one `account_id` to another `account_id`.

## 7. Opening Balance
- **UI Flow:** Onboarding / Party Creation.
- **Accounts:** Processed securely via `onboarding_rpc.sql` upon tenant creation.
- **Parties:** Supported via `parties/actions.ts` -> `createParty`.
- **Validation/Safety:** Safe. If a user manually edits the `opening_balance` column, the `trg_party_opening_balance_change` trigger dynamically recalibrates the `current_due` delta without recursion.

## 8. Adjustment
- **UI Flow:** Inventory -> Adjust Stock.
- **Server Action:** `recordMovement` (`inventory/actions.ts`).
- **Validation:** **VULNERABLE.** Missing `hasPermission` check. Any user can trigger it.
- **Inventory Ledger:** Supported dynamically by sending type `adjustment` which invokes the `set_inventory_movement_balances` trigger to recalculate stock.

## 9. Refund / Reversal
- **Status:** **NOT IMPLEMENTED**
- **Details:** The system database schema supports `transaction_state` (`'pending', 'completed', 'cancelled', 'reversed'`), and the trigger supports calculating state transitions (e.g. `completed` -> `reversed`). However, there are zero Server Actions to trigger an `updateTransaction` or `deleteTransaction`. Transactions are functionally permanent unless deleted via raw SQL.

---

## Transaction Safety Baseline
* **Duplicate Submission:** Addressed completely. The `idempotency_keys` table uses a unique constraint, locking `request_path` and `payload`. Network retries are handled safely.
* **Failed Transactions / Partial Writes:** Addressed completely. All mutations invoke PL/pgSQL RPCs (`process_pos_sale`, `create_transaction_atomic`). Standard Postgres execution ensures that if any part fails (e.g. invalid account), the entire transaction explicitly rolls back. No orphan records are possible.
