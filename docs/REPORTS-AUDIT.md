# Reports System Audit

## Executive Summary
This document outlines the findings from the end-to-end trace of the BizTrack BD Reports module, verifying the SQL calculations, UI filters, export capabilities, and pagination logic against raw database records.

**Critical Finding:** The reporting system suffers from severe structural limitations. Pagination does not exist, and the database explicitly truncates data via hardcoded `LIMIT` clauses, meaning exports will silently drop records. Additionally, the Financial Profit report suffers from the same catastrophic accounting error as the dashboard, ignoring Cost of Goods Sold entirely.

---

## 1. Flow Verification & Feature Matrix

| Feature | Status | Observation |
| :--- | :--- | :--- |
| **Sales Report** | 🟡 Partial | Works, but truncates data to the top 20 products. |
| **Expense Report** | 🟡 Partial | Works, but truncates data to the top 15 notes. |
| **Financial Report**| 🔴 Broken | Net Profit calculation is factually incorrect. |
| **Due Report** | 🟢 Accurate | Fetches accurate materialized O(1) balances. |
| **Inventory Report**| 🟢 Accurate | Fetches accurate materialized O(1) stock. |
| **Account Report** | 🔴 Missing | Not implemented anywhere in the UI or Actions. |
| **Transaction Rep.**| 🔴 Missing | Not implemented anywhere in the UI or Actions. |
| **Daily Closing Rep**| 🔴 Missing | Not implemented anywhere in the UI or Actions. |

## 2. Integrity Checks & Missing Mechanics

### A. Non-Existent Pagination & Silent Truncation (Critical)
- **The Issue:** There is no pagination logic implemented in the Next.js API or the UI.
- **The Bug:** To prevent overwhelming the UI, the database RPCs (`get_sales_analytics` and `get_expense_analytics`) blindly hardcode `LIMIT 20` and `LIMIT 15` on their queries. 
- **The Result:** If a user sells 100 different products in a month, the report will only return the top 20. The user has no way to see the remaining 80 products. Even worse, the Export function blindly downloads this truncated JSON, meaning the exported CSV will only contain 20 rows, permanently hiding the rest of the business data.

### B. The Profit Calculation Bug
- **The Issue:** The `get_financial_summary` RPC calculates Net Profit as `Income - Expenses`.
- **The Bug:** In the latest migration (`financial_integrity_fixes.sql`), the `purchase` transaction type was explicitly removed from the expense aggregation.
- **The Result:** The Financial Report completely ignores Cost of Goods Sold. If a business sells ৳10,000 of goods that cost ৳8,000 to purchase, the report will declare a net profit of ৳10,000. It treats 100% of sales revenue as pure profit.

### C. Missing Filters
- **Date Range:** Implemented successfully. `p_start_date` and `p_end_date` are correctly applied to the Postgres queries.
- **Branch / Account / Category / Party:** None of these filters are implemented in the UI or the backend RPCs. The reports strictly aggregate the entire business.
- **Search:** No search filtering exists for any report.

### D. Timezone & Boundary Edge Cases
- **Timezone:** Secure. The database enforces `NOW() AT TIME ZONE 'Asia/Dhaka'` for all transaction dates, meaning boundaries perfectly align with local Bangladesh time.
- **Empty Periods:** Secure. The SQL correctly utilizes `COALESCE(SUM(...), 0)` to prevent `NULL` crashes during empty periods.

---

## Conclusion
The Reports module is fundamentally unsuited for large datasets due to the hardcoded SQL `LIMIT` truncation and lack of pagination. Furthermore, the financial metrics are untrustworthy due to the omission of Cost of Goods Sold from the Net Profit calculation.
