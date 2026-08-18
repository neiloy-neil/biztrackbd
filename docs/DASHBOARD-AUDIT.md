# Dashboard Systems Audit

## Executive Summary
This document traces every metric displayed on the BizTrack BD Dashboard from the UI component down to the PostgreSQL calculation. 

**Critical Finding:** While lifetime balances (Dues, Payables, Cash) are calculated securely and correctly, the "Profit" and "Trend" calculations are deeply flawed. They completely ignore Cost of Goods Sold (Purchases) and treat 100% of sales revenue as pure profit. Additionally, the Low Stock warning relies on a hardcoded UI threshold rather than the database configuration.

---

## 1. Flow Verification & Metric Tracing

| Metric | DB Source | Calculation Method | Status | Observation |
| :--- | :--- | :--- | :--- | :--- |
| **Sales** | `transactions` | `SUM(total_amount)` where `type = 'sale'` | 🟢 Accurate | Correctly respects Date Filters. |
| **Revenue** | `transactions` | N/A (Uses Sales) | 🔴 Incomplete | Completely ignores `income` transactions (e.g., non-sale revenues like interest or fees). |
| **Expenses** | `transactions` | `SUM(total_amount)` where `type = 'expense'` | 🟢 Accurate | Correctly respects Date Filters. |
| **Profit** | N/A | `total_sales - total_expenses` | 🔴 Broken | Completely ignores `purchase` (Cost of Goods Sold). It treats 100% of a sale as pure profit without deducting the cost of the item. |
| **Available Money**| `account_transactions`| `SUM(amount)` across all accounts | 🟢 Accurate | Securely aggregates the true ledger. Correctly bypasses Date Filters because it is a lifetime balance. |
| **Customer Dues** | `parties` | `SUM(current_due)` where `type IN ('customer', 'both')` | 🟢 Accurate | Highly performant O(1) query hitting the materialized trigger cache. Correctly bypasses Date Filters. |
| **Supplier Payables**| `parties` | `SUM(current_due)` where `type IN ('supplier', 'both')` | 🟢 Accurate | Same as Customer Dues. |
| **Recent Txns** | `transactions` | Select top 10 order by `created_at DESC` | 🟢 Accurate | Direct query. Timezones are correctly bound to `Asia/Dhaka` via DB default. |

---

## 2. Integrity Checks

### A. The Hardcoded Low-Stock Bug
- **The Issue:** The UI component `LowStockProducts.tsx` explicitly calls `getLowStockProducts({ threshold: 10, limit: 5 })`.
- **The Bug:** The query filters `current_stock <= 10` rather than checking `current_stock <= min_stock`. 
- **The Result:** The dashboard ignores the user's configured `min_stock` per product. If a user sets a product's minimum stock to 50, the dashboard will not warn them until it hits 10. Conversely, a product with a minimum stock of 2 will constantly trigger warnings when its stock is between 3 and 10.

### B. Chart & Trend Skew
- **The Issue:** `get_trend_data` aggregates `sale` and `expense` totals by date (`MM-DD`).
- **The Bug:** Just like the Profit calculation, the trend chart completely ignores `purchase` (COGS) and `income`. 
- **The Result:** The visual "Profit" gap between the sales line and the expense line on the chart is mathematically false and heavily skewed.

### C. Filter Behavior
- **Date Filters:** Date filters (`startDate`, `endDate`) are correctly applied to period-bound metrics (Sales, Expenses, Trends) and correctly ignored for lifetime metrics (Cash, Dues, Payables).
- **Branch Filters:** Not implemented. The `get_dashboard_summary` RPC strictly accepts `p_business_id` and aggregates metrics across all branches in the business. There is no UI code implementing a branch selector.

---

## Conclusion
The Dashboard safely reads from the correct tables and applies caching/indexes effectively, avoiding raw iteration over millions of rows. However, the financial formulas themselves (Profit, Revenue, Low Stock) are hardcoded with naive assumptions that render them factually incorrect for accounting purposes.
