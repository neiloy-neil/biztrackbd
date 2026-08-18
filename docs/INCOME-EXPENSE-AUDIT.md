# Income & Expense Feature Audit

## Overview
This document audits the entire lifecycle of Income and Expense transactions in BizTrack BD, tracing them from creation through the database, ledger, reporting, and dashboard aggregations.

**Important Note:** Editing and Deleting/Reversing transactions are currently **NOT IMPLEMENTED** at the backend layer. While the UI has placeholders for "Updated" and "Reversed" audit trails, there are no server actions to perform these operations.

---

## Complete Flow Audit

### 1. Creation & Validation
- **Action:** `createTransaction` in `transactions/actions.ts`
- **Validation:** Validates that amount is positive and the account exists and belongs to the business.
- **Type Mismatch:** The UI uses `payment_in` to represent pure income. The underlying database enum has an explicit `income` type, but it is never utilized by the UI or the backend action logic (which strictly expects `'sale' | 'expense' | 'payment_in' | 'payment_out'`).
- **Idempotency:** Implemented correctly via `idempotentAction` locking, preventing duplicate network submissions.
- **Audit Logs:** **MISSING.** The `create_transaction_atomic` DB RPC inserts the records directly but fails to trigger an `INSERT INTO audit_logs`. There are no database triggers recording the transaction creation into the system's `audit_logs` table.

### 2. Database & Ledger Updates
- **Atomic Operations:** Correct. The system uses a PostgreSQL RPC (`create_transaction_atomic`) to insert the transaction and the associated `account_transactions` in a single implicit transaction, avoiding partial writes.
- **Supplier Ledger Flaw:** The database trigger `trg_maintain_party_balance` automatically maintains customer and supplier dues. However, it explicitly ignores transactions with `type = 'expense'`. If a user logs an expense against a supplier (e.g., buying something on credit), the supplier's payable balance **will not update**. It only aggregates `purchase` and `payment_out`.
- **Timezone:** Fixed recently via database migration. Dates default to `Asia/Dhaka` locally at the DB level, preventing late-night UI transactions from slipping into the previous UTC date.

### 3. Account Updates (Cash/Bank)
- **Mechanism:** Accounts don't store a hardcoded balance. Balances are derived dynamically by summing `account_transactions`.
- **Integrity:** The `create_transaction_atomic` correctly determines the sign (`-p_total_amount` for expense/payment_out, `+p_total_amount` for payment_in/sale) ensuring the ledger remains mathematically sound without race conditions.

### 4. Dashboard Totals (The "Profit" Bug)
- **Mechanism:** The dashboard UI calls `getDashboardSummary`, which relies on the `get_dashboard_summary` DB RPC to prevent N+1 queries.
- **Aggregation Error:** The RPC computes `total_sales` (where type='sale') and `total_expenses` (where type='expense'). 
- **Profit Calculation:** It computes `estimated_profit = total_sales - total_expenses`. 
- **The Bug:** It completely ignores `payment_in` or `income`. Any pure income recorded by the user successfully increases the bank account balance but is **completely invisible** in the Dashboard's profit calculation or top-line revenue metrics.

### 5. Reporting
- **Mechanism:** The `FinancialReport` queries rely on `reports/actions.ts`. 
- **Cache:** Since the application uses Next.js App Router Server Actions, it relies on `revalidatePath('/dashboard')` and `revalidatePath('/transactions')` to clear the Next.js cache. However, `createTransaction` **does not** call `revalidatePath('/reports')`. Thus, generating a new expense or income might not immediately reflect in the financial reports tab until a hard refresh occurs.

---

## Summary of Findings

| Sub-system | Status | Observation |
| :--- | :--- | :--- |
| **Transaction Creation** | 🟢 Secure | Idempotent, atomic DB insertion. |
| **Edit/Delete** | 🔴 Missing | Impossible to fix mistakes; no mutation API exists. |
| **Account Balances** | 🟢 Secure | Derived from immutable ledger; mathematically sound. |
| **Supplier Balances** | 🔴 Broken | Expenses do not update supplier dues (only Purchases do). |
| **Dashboard Profit** | 🔴 Broken | Ignores `payment_in`/`income`; only calculates Sales vs Expenses. |
| **Audit Trail** | 🔴 Missing | Transaction creation is never written to `audit_logs`. |
| **Cache Invalidation** | 🟡 Partial | `reports` path is not revalidated after a transaction is created. |
