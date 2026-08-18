# BizTrack BD: Forensic Financial Architecture Audit

## 1. Executive Summary
This audit maps the flow of money through BizTrack BD’s core systems. The architecture relies on an immutable append-only ledger (`transactions` and `account_transactions`) to record financial movements, utilizing derived PostgreSQL Views and RPCs to calculate real-time balances.

**CRITICAL FINDINGS:** 
There are major architectural flaws in the financial calculations. The system currently suffers from **massive double-counting of party balances** and **omissions in daily closing reconciliation**, which will result in corrupted financial data.

---

## 2. Ledger Architecture

### Core Entities
1. **Parties (`parties`)**: Customers and Suppliers. Contains `opening_balance`.
2. **Accounts (`accounts`)**: Financial repositories (`cash`, `bank`, `mobile_money`).
3. **Transactions (`transactions`)**: The master record of an event (`sale`, `purchase`, `expense`, `income`, `payment_in`, `payment_out`).
4. **Account Transactions (`account_transactions`)**: The actual movement of money in/out of an `account` linked to a `transaction`.

### Flow Mechanism
When an event occurs, an RPC (e.g., `process_pos_sale`, `create_transaction_atomic`) creates ONE record in `transactions` and ONE OR MORE records in `account_transactions`.

---

## 3. Party Balances (Customer Due / Supplier Payable)

The system calculates real-time customer and supplier balances using the `v_party_balances` view.

**Formula used in view:**
- Customer: `opening_balance + sum(sale total) - sum(payment_in total)`
- Supplier: `opening_balance + sum(purchase total) - sum(payment_out total)`

### 🚨 CRITICAL BUG: Ignored Partial Payments
When a sale is made via POS (`process_pos_sale`), the RPC creates a `transactions` record with `type = 'sale'` and total amount. If the customer pays a partial amount at the time of sale, the RPC inserts that payment into `account_transactions` linked to the same `sale` transaction.

However, `v_party_balances` only looks at the `transactions.type` column. Because the transaction type is `'sale'`, it adds the `total_amount` to the customer's due, but **completely ignores the partial payment** stored in `account_transactions`. 

*Example:* 
- Sale of 10,000 BDT. Customer pays 4,000 BDT upfront.
- Customer Due increases by 10,000 BDT (instead of 6,000 BDT).
- If they later pay the 10,000 BDT due via a standalone `payment_in` transaction, they will have paid 14,000 BDT for a 10,000 BDT sale.

This affects both Customers (Sales) and Suppliers (Purchases).

---

## 4. Account Balances and Daily Closing

The `get_daily_closing_summary` RPC calculates the daily expected cash and reconciles it.

### Expected Cash Calculation
`Expected Cash = Sum of all account_transactions for 'cash' accounts up to date`
This calculation is **mathematically sound** and accurate because it relies on the absolute truth of the double-entry `account_transactions` ledger.

### 🚨 CRITICAL BUG: Broken Daily Breakdown
The RPC breaks down the daily movements into categories to explain the expected cash to the user:
- `cash_sales` (Filters `t.type = 'sale'`)
- `cash_expenses` (Filters `t.type = 'expense'`)
- `cash_received` (Filters `t.type = 'payment_in'`)
- `cash_paid` (Filters `t.type = 'payment_out'`)

**The missing types:**
The breakdown **completely omits** `income`, `purchase`, `opening_balance`, and `transfer` transactions.
If 5,000 BDT is received as `income` today, the `expected_cash` will increase by 5,000 BDT, but the daily breakdown will not show where that money came from, causing the cashier to fail their daily reconciliation.

---

## 5. Atomicity and Sign Conventions

The `create_transaction_atomic` RPC dictates how signs (+/-) are applied to `account_transactions`:

```sql
v_account_amount := CASE
  WHEN p_type IN ('sale', 'income', 'payment_in', 'opening_balance') THEN  p_total_amount
  WHEN p_type IN ('expense', 'purchase', 'payment_out')              THEN -p_total_amount
  ELSE p_total_amount
END;
```

### Sign Convention Audit
1. **Sale / Income / Payment In / Opening Balance**: Positive `amount`. Increases account balance (Debit). **(Correct)**
2. **Expense / Purchase / Payment Out**: Negative `amount`. Decreases account balance (Credit). **(Correct)**

### 🚨 CRITICAL BUG: Transfers
The system defines a `transfer` transaction type, but `create_transaction_atomic` only accepts a single `p_account_id` parameter. A true transfer requires deducting money from a source account and adding it to a destination account simultaneously (two `account_transactions` records). The current RPC architecture cannot support transfers atomically.

---

## 6. Inventory Valuation
Inventory valuation is tracked via `inventory_movements` (Immutable ledger of `in`, `out`, `adjustment`).
When a sale is made via POS, `inventory_movements` correctly logs an `out` movement.
Triggers run over `inventory_movements` to update stock levels. This aspect of the system appears logically sound and atomic.

## 7. Audit Conclusion
The core append-only ledger concept is solid, but the reporting layer (Views and RPCs) that derives state from the ledger is fundamentally flawed. 

**Immediate required actions (Out of scope for this audit):**
1. Rewrite `v_party_balances` to calculate dues based on `account_transactions` rather than `transactions.total_amount`, OR enforce a strict separation where a sale and its payment are two distinct `transactions` records.
2. Update `get_daily_closing_summary` to map all transaction types to the daily breakdown.
3. Create a dedicated `process_transfer` RPC that handles two account IDs.
