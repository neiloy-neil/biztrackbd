# Financial Scenario Validation & Simulation

## Methodology
This document simulates a comprehensive financial scenario against the **current** source code and database architecture of BizTrack BD. The goal is to dry-run a series of financial operations, calculate the expected real-world outcomes, and contrast them with what the system's PostgreSQL views and RPCs currently compute.

**Scenario Initial State:**
- Business: "Test Business"
- Accounts: Cash (৳0), bKash (৳0)
- Customers: Rahim (Due: ৳0)
- Suppliers: Karim (Payable: ৳0)
- Inventory: Product A (0 units, Cost: ৳600, Price: ৳1,000)

---

## Step-by-Step Simulation

### 1. Opening Cash: ৳50,000
**Operation**: Create an `opening_balance` transaction.
- **Expected**: Cash = ৳50,000. 
- **Actual**: Cash = ৳50,000.
- **Difference**: None. `create_transaction_atomic` correctly applies positive sign to `opening_balance`.

### 2. Purchase 10 units of Product A
**Operation**: Total ৳6,000. Pay supplier ৳2,000 at the time of purchase.
- **Expected**: Cash = ৳48,000, Supplier Due = ৳4,000. Inventory = 10 units.
- **Actual**: Cash = ৳48,000, Supplier Due = **৳6,000**.
- **Difference**: Supplier Due is ৳2,000 higher than expected.
- **Root Cause**: The `v_party_balances` view calculates supplier due as `SUM(purchase) - SUM(payment_out)`. Because the ৳2,000 payment was recorded under the `purchase` transaction type in `account_transactions`, it is ignored by the view.

### 3. Sell 5 units to Rahim
**Operation**: Total ৳5,000. Customer pays ৳2,000 upfront.
- **Expected**: Cash = ৳50,000, Customer Due = ৳3,000. Inventory = 5 units.
- **Actual**: Cash = ৳50,000, Customer Due = **৳5,000**.
- **Difference**: Customer Due is ৳2,000 higher than expected.
- **Root Cause**: Same as above. `v_party_balances` ignores partial payments recorded under the `sale` transaction type. It only deducts `payment_in` transactions.

### 4. Receive ৳1,000 from Rahim
**Operation**: Standalone `payment_in` from customer.
- **Expected**: Cash = ৳51,000, Customer Due = ৳2,000.
- **Actual**: Cash = ৳51,000, Customer Due = **৳4,000** (৳5,000 previous - ৳1,000).
- **Difference**: Customer Due remains historically inflated by ৳2,000.

### 5. Add Business Income ৳2,000
**Operation**: Non-sale revenue stream recorded as `income`.
- **Expected**: Cash = ৳53,000. Total Profit = ৳4,000 (৳2,000 from sales + ৳2,000 income).
- **Actual**: Cash = ৳53,000. Total Profit = **৳5,000**.
- **Difference**: Total Profit is wrong.
- **Root Cause**: The system calculates profit in `get_daily_closing_summary` purely as `v_total_sales - v_total_expenses`. It ignores COGS completely (overstating sales profit by ৳3,000) and ignores `income` (understating profit by ৳2,000).

### 6. Add Expense ৳800
**Operation**: Standard business expense.
- **Expected**: Cash = ৳52,200. Profit = ৳3,200.
- **Actual**: Cash = ৳52,200. Profit = **৳4,200**.
- **Difference**: Profit calculation remains fundamentally incorrect due to missing COGS/Income.

### 7. Pay Karim ৳1,500
**Operation**: Standalone `payment_out` to supplier.
- **Expected**: Cash = ৳50,700. Supplier Due = ৳2,500.
- **Actual**: Cash = ৳50,700. Supplier Due = **৳4,500** (৳6,000 previous - ৳1,500).
- **Difference**: Supplier Due remains historically inflated.

### 8. Transfer ৳5,000 (Cash → bKash)
**Operation**: Transfer money between accounts.
- **Expected**: Cash = ৳45,700, bKash = ৳5,000.
- **Actual**: The `create_transaction_atomic` RPC only accepts a *single* `p_account_id`. It is architecturally impossible to deduct from Cash and add to bKash atomically in one transaction using the current database functions. If attempted via two transactions, it violates ledger atomicity and pollutes the ledger with unbalanced entries.

### 9. Sell 2 units to Rahim (Paid in full)
**Operation**: Total ৳2,000. Customer pays full ৳2,000.
- **Expected**: Cash = ৳47,700 (assuming transfer succeeded). Customer Due = ৳2,000 (unchanged).
- **Actual**: Cash = ৳47,700. Customer Due = **৳6,000**.
- **Difference**: Customer Due increases by ৳2,000 despite the customer paying in full.
- **Root Cause**: The ৳2,000 payment was recorded under the `sale` transaction, and `v_party_balances` blindly adds the sale total to the due without checking `account_transactions`.

### 10. Close the Day
**Operation**: Cashier runs end-of-day reconciliation.
- **Expected**: Cash drawer should hold ৳47,700. The breakdown should explain exactly how we got from ৳0 to ৳47,700 today.
- **Actual**: 
  - `expected_cash` correctly computes **৳47,700** (by summing all cash `account_transactions`).
  - However, the breakdown components in `get_daily_closing_summary` are wildly incorrect:
    - `cash_sales`: ৳4,000 (Correctly sums sales payments)
    - `cash_received`: ৳1,000 (Only counts `payment_in`, ignores sales payments)
    - `cash_paid`: ৳1,500 (Only counts `payment_out`, ignores purchase payments)
    - `cash_expenses`: ৳800
  - **The Breakdown Gap**: The breakdown explains a net change of `+ ৳2,700`. It completely omits the `opening_balance` (+৳50,000), `purchase` (-৳2,000), `income` (+৳2,000), and `transfer` (-৳5,000). The cashier is presented with a breakdown that does not sum to the expected cash in the drawer.

---

## Summary of Variances

| Step | Metric | Expected Result | Actual System Result | Difference | Severity |
|---|---|---|---|---|---|
| 2 | Supplier Due | ৳4,000 | ৳6,000 | + ৳2,000 | CRITICAL |
| 3 | Customer Due | ৳3,000 | ৳5,000 | + ৳2,000 | CRITICAL |
| 5 | Profit | ৳4,000 | ৳5,000 | + ৳1,000 | CRITICAL |
| 8 | Transfer (Cash) | ৳45,700 | Undefined | Atomicity breaks | HIGH |
| 9 | Customer Due | ৳2,000 | ৳6,000 | + ৳4,000 | CRITICAL |
| 10 | Daily Cash Breakdown | Explains ৳47,700 | Explains ৳2,700 | Missing ৳45,000 | CRITICAL |

## Conclusion
The system successfully maintains the absolute integrity of cash balances via the `account_transactions` table. However, **every derived financial view and summary RPC is fundamentally broken**. 
- Customer/Supplier dues will infinitely inflate because the system ignores point-of-sale payments.
- Profit calculation ignores Cost of Goods Sold (COGS) and non-sale Income.
- Daily closings will confuse cashiers daily due to missing transaction types in the breakdown.
