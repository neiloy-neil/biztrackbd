# Accounts System Full Audit Report

## Executive Summary
This document audits the complete lifecycle for the Accounts system (Cash, Bank, Mobile Money), including ledger balance integrity, transaction operations, and reporting mismatches across the dashboard and daily closings.

**Critical Finding:** While the core ledger (`account_transactions`) is mathematically sound and strictly atomic, the **Daily Closing system is completely disconnected from the true ledger**. The Daily Closing module hardcodes specific transaction types and account names to calculate its balances, leading to severe scenarios where the Displayed Balance completely diverges from the True Ledger Balance.

---

## 1. Operations Verification

| Operation | Status | Observation |
| :--- | :--- | :--- |
| **Sales** | 🟢 Secure | Automatically records cash flow into selected account via POS checkout. |
| **Expenses** | 🟢 Secure | Deducts from selected account accurately. |
| **Deposits/Withdrawals** | 🟡 Workaround | Not explicitly implemented; users must use `payment_in` / `payment_out` as workarounds. |
| **Transfers** | 🔴 Missing | Although `transfer` exists in the DB enum, there is no UI or Server Action to move money between accounts (e.g., Bank -> Cash). |
| **Account Opening Balance** | 🟢 Secure | Configured securely during business tenant onboarding (`p_opening_balances`). |

## 2. Integrity Checks

### A. Ledger Soundness
- **Duplicate Transactions:** Prevented. API requests utilize `idempotentAction` locking the payload. 
- **Partial Writes/Failed Operations:** Prevented. `create_transaction_atomic` and `process_pos_sale` strictly insert `account_transactions` alongside the parent transaction in an implicit atomic block. If an account is invalid or deleted, the transaction aborts with zero partial writes.
- **Ledger Balance:** Accounts do not store a hardcoded balance. The true balance is computed accurately on-the-fly (`SUM(amount) FROM account_transactions`), preventing race conditions.

### B. Displayed Balance != Ledger Balance (CRITICAL BUGS)

I successfully identified two major situations where the system reports wildly inaccurate account balances to the user:

#### 1. The Mobile Money Hardcoding Bug (Daily Closing)
- **The Issue:** The `get_daily_closing_summary` Database RPC calculates Mobile Money balances by explicitly checking if the account name contains specific strings: `a.name ILIKE '%bkash%'` and `a.name ILIKE '%nagad%'`.
- **The Mismatch:** If a user creates a mobile money account and names it "Personal Wallet" or "Rocket", the Dashboard (Money Visibility) will display the funds correctly, but the Daily Closing Report will show **0** for those accounts, as it completely fails to aggregate them based on the `type` column.

#### 2. The Expected Cash Desync Bug (Daily Closing)
- **The Issue:** To calculate the `expected_cash` for the register at the end of the day, the Daily Closing RPC attempts to recreate the math using yesterday's cash plus today's cash flow. 
- **The Flaw:** Instead of summing the true `account_transactions` for the day, the RPC manually aggregates exactly four transaction types: `sale`, `payment_in`, `expense`, and `payment_out`. 
- **The Mismatch:** If an `opening_balance` is injected into a cash account, or if pure `income` is recorded, the Daily Closing script **completely ignores those cash flows**. The Dashboard Ledger will show `৳10,000` in Cash, but the Daily Closing Expected Cash will demand `৳0`, rendering the daily closing audit feature functionally useless and causing permanent ledger desynchronization for the cashier.

---

## Conclusion
The underlying double-entry ledger is secure and atomic. However, the aggregation layers—specifically the `get_daily_closing_summary` RPC—are fundamentally flawed, hardcoding business logic and names that break apart from the true `account_transactions` source of truth. Transfers and direct deposit/withdrawal actions are also notably missing.
