# FINAL FORENSIC FINANCIAL AUDIT: BizTrack BD

## 1. Current Architecture & Source of Truth Matrix

The current repository has **divergent sources of truth** for financial party balances, resulting in severe double-counting and logic conflicts.

### Source-of-Truth Matrix
| Component / Domain | Source of Balance | Fields Used |
| :--- | :--- | :--- |
| **Dashboard** (`get_dashboard_summary`) | `parties` table | `SUM(current_due)` |
| **Parties List UI** (`getParties`) | `v_party_balances` | `current_due` |
| **Reports** (`get_party_dues`) | `v_party_balances` | `party_id`, `balance` (BROKEN) |

The UI queries `v_party_balances` in `src/domains/parties/actions.ts`, but the dashboard RPC calculates its totals strictly from the mutable `parties.current_due` column. Because the trigger `maintain_party_balance()` and the view `v_party_balances` calculate the totals differently, **the dashboard and the parties page will show fundamentally different numbers**.

## 2. Final Effective Database Definitions

The latest future-dated migrations (`20270101000001_financial_p0_p1_fixes.sql` and `20270101000002_financial_p2_p3_fixes.sql`) override earlier RPCs.

- **`maintain_party_balance()`**: Triggers on `INSERT` or `UPDATE` of `transactions`. (Migration: 20260817150000).
- **`v_party_balances`**: Replaces the old view entirely. (Migration: 20270101000001).
- **`get_party_dues()`**: Queries `v_party_balances` but uses incorrect column aliases. (Migration: 20270101000002).
- **`get_daily_closing_summary()`**: Complete rewrite including cash flow breakdowns. (Migration: 20270101000001).
- **`get_dashboard_summary()`**: Rewritten to pull from `parties.current_due`. (Migration: 20260818210000).

---

## 3. Financial Formulas

### A. Customer Formula
**Expected Model**: `Opening + Credit Sales - Payments - Credits`

**Actual `v_party_balances`**:
```sql
(CASE WHEN t.type = 'sale' THEN t.total_amount ELSE 0 END) - 
(CASE WHEN t.type IN ('sale', 'payment_in') THEN COALESCE(paid.paid_amount, 0) ELSE 0 END)
```
- **Evaluation**: CORRECT. `paid_amount` for a sale is positive cash received. The view subtracts cash paid at the time of sale, making it equivalent to Credit Sales.

**Actual `maintain_party_balance()` trigger**:
```sql
IF NEW.type IN ('sale', 'opening_balance') THEN
  UPDATE public.parties SET current_due = current_due + NEW.total_amount ...
```
- **Evaluation**: **CRITICAL ERROR (P0)**. The trigger blindly adds the `total_amount` of a sale to the customer's due, regardless of how much cash was paid upfront. It completely ignores `account_transactions` for partial or full immediate payments.
- **Example**: Cash sale of ৳10,000 (Paid ৳10,000). The view says Due = 0. The trigger makes `parties.current_due` = 10,000.

### B. Supplier Formula
**Expected Model**: `Opening + Credit Purchases - Payments - Credits`

**Actual `v_party_balances`**:
```sql
(CASE WHEN t.type = 'purchase' THEN t.total_amount ELSE 0 END) + 
(CASE WHEN t.type IN ('purchase', 'payment_out') THEN COALESCE(paid.paid_amount, 0) ELSE 0 END)
```
- **Evaluation**: CORRECT. For `purchase` and `payment_out`, money leaves the business, so `account_transactions.amount` is explicitly inserted as a negative number by `create_transaction_atomic`. The view adds this negative value (`+ (-paid_amount)`), accurately decreasing the supplier payable.

**Actual `maintain_party_balance()` trigger**:
```sql
ELSIF NEW.type = 'payment_out' THEN
  UPDATE public.parties SET current_due = current_due - NEW.total_amount ...
```
- **Evaluation**: INCORRECT FOR PURCHASES (P0). Like sales, if a purchase has an upfront payment, the trigger ignores it and adds the full `total_amount` to payable.

### C. Account Formula
**Expected Model**: Sum of all `account_transactions`.
- **Actual**: `maintain_account_balance()` perfectly synchronizes `accounts.current_balance` by summing `NEW.amount`. `amount` sign convention is strictly enforced in `create_transaction_atomic`. (Correct).

### D. Income Formula & Expense Formula
- **Income**: Added to `account_transactions` as Positive (+). Does not affect party balances. (Correct).
- **Expense**: Added to `account_transactions` as Negative (-). Does not affect party balances. (Correct).

### E. Profit Formula
- **Dashboard (`get_dashboard_summary`)**: `(Sales - COGS) + Income - Expenses`
- **Reports (`get_financial_summary`)**: `(Sales + Income) - (COGS + Expenses)`
- Both models are mathematically identical and correct.

---

## 4. UI/Database Mismatches & UI Bugs

### A. The Supplier Expense Bug (P0)
**File**: `src/app/app/parties/[id]/party-action-drawer.tsx`
**Action**: "পণ্য কিনলাম" (I bought goods)
**Current Behavior**: Creates a transaction of `type = 'expense'`.
**Downstream Financial Impact**:
- **Party Balance**: Unchanged. `maintain_party_balance` and `v_party_balances` ignore `expense` for suppliers.
- **Account Balance**: Unchanged, because the UI hardcodes `requiresAccount: false` for this action, leaving `account_id` undefined.
- **Expense Report**: Inflates business expenses artificially.
- **Profit**: Decreases artificially due to the fake expense.
- **Inventory/COGS**: Unchanged.
**Expected Behavior**: Buying goods from a supplier is a **`purchase`**, which correctly inflates supplier payable without directly hitting P&L until COGS is recognized via sales.

### B. View / RPC Schema Conflict (P0)
**Files**: `src/domains/parties/actions.ts` vs `get_party_dues()` vs `v_party_balances`

1. The frontend (`actions.ts`) queries `v_party_balances` with `.is('deleted_at', null)`. However, **`v_party_balances` does not expose `deleted_at`**. This will cause a Postgres runtime crash (`column does not exist`).
2. The RPC `get_party_dues()` queries `party_id` and `balance` from `v_party_balances`. However, the view was rewritten in `20270101000001` to expose `id` and `current_due`. The RPC will crash immediately upon execution.

---

## 5. Financial Scenario Test

**Parameters**:
Opening Cash = ৳50,000 | Sale = ৳10,000 (Paid ৳6,000) | Purchase = ৳20,000 (Paid ৳8,000) | Income = ৳3,000 | Expense = ৳2,000 | Transfer Cash->bKash = ৳5,000 | Cust Pays Later = ৳2,000 | Supp Pays Later = ৳5,000

**Expected Outcomes**:
- Cash = ৳41,000
- bKash = ৳5,000
- Customer Due = ৳2,000
- Supplier Payable = ৳7,000
- Revenue = ৳13,000
- Profit = ৳11,000

**Actual Code Execution (Mathematical Trace)**:
- **Cash**: `50k + 6k - 8k + 3k - 2k - 5k + 2k - 5k` = ৳41,000 (MATCH)
- **bKash**: ৳5,000 (MATCH)
- **Revenue**: Sale(10k) + Income(3k) = ৳13,000 (MATCH)
- **Profit**: Sales(10k) + Income(3k) - Exp(2k) = ৳11,000 (MATCH)
- **Supplier Payable**: 
  - `v_party_balances`: 20k + (-8k + -5k) = ৳7,000 (MATCH)
  - `parties.current_due`: 20k - 5k = ৳15,000 (MISMATCH - ignoring partial payment)
- **Customer Due**:
  - `v_party_balances`: 10k - (6k + 2k) = ৳2,000 (MATCH)
  - `parties.current_due`: 10k - 2k = ৳8,000 (MISMATCH - ignoring partial payment)

---

## 6. Financial Integrity Issues Matrix

| Issue | Severity | Component | Description | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Broken Trigger** | P0 | `maintain_party_balance()` | Trigger ignores upfront cash payments on sales/purchases, overstating physical due in `parties.current_due`. | Calculate due delta by evaluating `NEW.total_amount - SUM(account splits)`. |
| **UI Type Mismatch** | P0 | `party-action-drawer.tsx` | "পণ্য কিনলাম" triggers an `expense` instead of a `purchase`. | Change type to `purchase`. |
| **API/View Crash** | P0 | `actions.ts`, `get_party_dues` | Queries non-existent columns (`deleted_at`, `party_id`, `balance`) on `v_party_balances`. | Fix column names in RPCs and frontend queries to match view output (`id`, `current_due`). |
| **Divergent Dashboards** | P1 | `get_dashboard_summary` | Dashboard queries broken `parties.current_due` instead of accurate `v_party_balances`. | Switch dashboard to SUM from `v_party_balances` or fix the trigger. |
| **Double Counting Risk** | P0 | Cash Sales | Because the trigger ignores the cash split, a cash sale inflates both Cash AND Customer Due simultaneously. | Fix the trigger. |

**Audit Conclusion**: 
The database logic currently holds robust transaction-level double-entry accounting (splits enforce correct signs). However, the **caching layer (`parties.current_due`) is fundamentally flawed**, leading to wildly inaccurate party balances on the dashboard. Furthermore, the UI creates false expenses instead of purchases, corrupting the P&L report.
