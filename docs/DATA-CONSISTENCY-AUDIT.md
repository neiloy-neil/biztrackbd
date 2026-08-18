# Data Consistency Audit

## Executive Summary
This document outlines the data consistency architecture across the BizTrack platform. Because the application was rewritten using Domain-Driven Design (DDD), many historical sources of drift (such as materialized balances) were replaced with dynamic SQL Views. However, several critical areas of data drift remain, primarily driven by the lack of immutable ledgers and atomic transaction enforcement.

---

## Data Consistency Matrix

| Entity | Source of Truth | Derived Value | Calculation / Enforcer | Potential Drift | Severity |
|--------|-----------------|---------------|------------------------|-----------------|----------|
| **Party Balances (Due)** | `transactions` (Ledger) | Customer/Supplier Due | `v_party_balances` (SQL View) | **None.** The balance is calculated dynamically on-the-fly, summing transactions and opening balances. | Low |
| **Inventory Stock** | `inventory_movements` | `products.current_stock` | PostgreSQL Trigger | **Medium.** A trigger ensures movements update `current_stock`. However, race conditions during concurrent POS sales can drive `current_stock` negative before the trigger evaluates. | Medium |
| **Financial Double-Entry** | `account_transactions` (Splits) | `transactions.total_amount` | *None* | **Critical.** There is no database constraint enforcing that `transactions.total_amount = SUM(account_transactions.amount)`. A bug in the UI or a direct API call can create unbalanced financial records. | Critical |
| **Daily Closing History** | `transactions` | `daily_closing.expected_cash` | Snapshot on Close | **High.** Because `transactions` are not immutable (RLS allows `UPDATE` and `DELETE`), if a user edits a past transaction, the historical Daily Closing record becomes permanently out-of-sync with the ledger. | High |
| **SaaS Subscriptions** | `invoices` (Payment) | `subscriptions.status` | Webhook RPC (`process_payment_webhook`) | **High.** The webhook updates the invoice, then updates the subscription. If the RPC crashes mid-execution (or if a duplicate webhook hits before the lock settles), the invoice will be marked `paid` but the subscription will remain inactive. | Critical |
| **SaaS Usage Limits** | Live Table Rows | Entitlement Limit | `COUNT(*)` via `check_usage_limit()` | **None.** Limits are calculated dynamically by counting rows (e.g., `SELECT count(*) FROM branches`). | Low |

---

## Key Findings & Root Causes of Drift

### 1. The Immutable Ledger Failure (Daily Closing Drift)
The most severe consistency issue is the ability to mutate historical transactions. In a standard financial application, transactions are immutable append-only records. Because BizTrack allows users to `UPDATE` or `DELETE` transactions:
- **Result:** If a cashier deletes a cash sale from yesterday, yesterday's `daily_closing` record (which snapshotted `expected_cash`) is now permanently incorrect and orphaned. The ledger no longer supports the closing snapshot.

### 2. Unenforced Double-Entry (Internal Ledger Drift)
A transaction of $100 requires $100 to be deposited into an account (e.g., Cash). 
- **Result:** Because there is no database-level constraint (e.g., a deferred trigger) enforcing `total_amount = SUM(splits)`, a bug in the client payload can create a $100 sale with only $50 deposited into cash. The Dashboard Revenue will show $100, but the Account Balance will only show $50.

### 3. Non-Atomic Webhooks (Billing State Drift)
The webhook processing relies on sequential updates rather than a strict state machine. If an invoice is marked paid but the subscription update fails, the customer is charged but receives no service. 

## Recommendations
To achieve true data consistency, the following must be implemented in the Execution Phase:
1. Strip `UPDATE` and `DELETE` RLS policies from `transactions` and `account_transactions`.
2. Add a `CONSTRAINT` or `TRIGGER` to strictly enforce double-entry arithmetic.
3. Wrap webhook processing in strict atomic blocks and utilize idempotency keys.
