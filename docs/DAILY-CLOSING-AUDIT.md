# Daily Closing System Audit

## Executive Summary
This document outlines the end-to-end trace of the BizTrack BD Daily Closing module. The audit verifies the calculation of expected cash, handling of cash differences, timezone boundaries, and duplicate closing prevention.

**Critical Finding:** While the system correctly recalculates expected cash on the server (preventing client spoofing), it suffers from a catastrophic "Stacking Difference Bug." Cash shortages or overages are logged but never adjusted in the core ledger, meaning a one-time shortage will carry forward and register as a shortage every single day thereafter.

---

## 1. Flow Verification

| Step | Status | Observation |
| :--- | :--- | :--- |
| **Client Spoofing** | 🟢 Secure | The Next.js Action completely ignores the client's `expected_cash` and rigorously recalculates it server-side via the `get_daily_closing_summary` RPC. |
| **Duplicate Closing** | 🟢 Secure | Blocked at the database level via a `UNIQUE(business_id, closing_date)` constraint. |
| **Reopening / Correction** | 🔴 Missing | There is no Server Action or UI to reopen a closed day. Furthermore, `daily_closings` is protected by an RLS policy that completely blocks `UPDATE` and `DELETE`. |
| **Digital Payments** | 🔴 Broken | Digital balances (bKash, Nagad) are queried using brittle hardcoded string matching (`a.name ILIKE '%bkash%'`), meaning custom account names will completely bypass the summary. |

## 2. Integrity Checks

### A. The Stacking Difference Bug (Critical)
- **The Issue:** When a cashier counts the physical drawer and submits a difference (e.g., they are missing ৳500), the `closeDay` Server Action logs `difference: -500` into the `daily_closings` table.
- **The Bug:** The system **never creates a corresponding adjustment transaction** in the `account_transactions` ledger to represent the lost/missing cash.
- **The Result:** The next day, when `get_daily_closing_summary` calculates `expected_cash`, it does so by summing the entire mathematical history of the ledger from Day 0. Because the ledger was never adjusted for the missing ৳500, tomorrow's `expected_cash` will still demand that ৳500! A one-time shortage will manifest as a continuous, permanent shortage on every future daily closing.

### B. Post-Closing Transactions (Ledger Desync)
- **The Issue:** There is no database lock preventing new transactions on a date that has already been closed.
- **The Bug:** If a manager closes the day at 5:00 PM, and a cashier processes a sale at 6:00 PM, the sale will be recorded for "today." 
- **The Result:** The daily closing report for today is completely immutable and duplicate closings are blocked. The 6:00 PM sale will permanently fall outside the daily closing record for today, causing the printed closing receipt to diverge from the actual accounting ledger for that date. 

### C. Multi-Account Aggregation
- **The Issue:** The `get_daily_closing_summary` RPC aggregates ALL accounts of `type = 'cash'` into a single `expected_cash` metric.
- **The Result:** If a business has multiple cash drawers (e.g., "Front Desk Cash", "Back Office Cash"), they cannot be closed independently. The cashier must mathematically sum the physical cash from all drawers in the building to submit the closing.

---

## Conclusion
The Daily Closing module securely calculates ledger metrics but fails to bridge the gap between "reporting" and "accounting." The failure to inject cash adjustment transactions upon closing renders the module unusable for long-term day-to-day operations, as cash differences will infinitely compound.
