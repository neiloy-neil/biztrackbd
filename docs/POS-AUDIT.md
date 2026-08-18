# POS System End-to-End Audit

## Executive Summary
This document outlines the full end-to-end trace of the BizTrack BD Point of Sale (POS) module, verifying the flow from the client cart, through the Next.js Server Actions, down to the PostgreSQL RPC and database triggers. 

**Critical Finding:** The POS checkout process is currently **100% broken**. Due to missing parameters in the Server Action payload, the database RPC will crash on every submission. Furthermore, if this API bug were naively fixed, it would expose a massive ledger flaw where fully-paid customers are perpetually registered as having unpaid dues.

---

## 1. Flow Verification

| Step | Status | Observation |
| :--- | :--- | :--- |
| **Duplicate Submission** | 🟢 Secure | Protected securely by the `idempotentAction` wrapper and `idempotency_keys` table. |
| **Stock Deduction** | 🟢 Secure | Inserts `out` movements which trigger `trg_set_inventory_movement_balances`, correctly preventing negative stock via database row locks. |
| **Account Payments** | 🟢 Secure | Validates that the destination `account_id` belongs to the business before committing. |
| **Network Interruptions** | 🟢 Secure | Client wraps `processPOSSale` in a robust offline check and cleanly catches fetch errors. |

## 2. Critical Blockers & Vulnerabilities

### A. The "Dead Button" API Bug
- **The Issue:** The Database RPC `process_pos_sale` explicitly requires positional parameters for `p_total_amount` and `p_subtotal`. 
- **The Bug:** The Next.js Action `pos/actions.ts` simply forgets to include these parameters in the payload when calling `supabase.rpc(...)`. 
- **The Result:** The PostgreSQL engine rejects the call instantly with a `function does not exist` or `missing parameter` error. Every single POS sale attempts will fail.

### B. Missing Server-Side Math (Price Manipulation Risk)
- **The Issue:** The codebase explicitly comments: `// Only product_id + quantity sent to server; prices come from the DB.`
- **The Bug:** The Server Action never actually queries the `products` table for the prices, nor does it calculate the totals. It literally skips the step.
- **The Vulnerability:** If a developer attempts to fix Bug A by simply passing the client's `cartTotal` into `p_total_amount`, they will introduce a catastrophic vulnerability allowing the client to fully control the cart total and item prices (e.g., buying 10 items for ৳0.01).

### C. The Permanent Due Ledger Flaw (Double Charge)
- **The Issue:** When a sale is processed, `process_pos_sale` inserts the parent transaction (type = `'sale'`) and processes any incoming cash by inserting directly into `account_transactions`.
- **The Bug:** The database trigger `trg_maintain_party_balance` fires immediately upon seeing the new `'sale'` transaction. It adds the full `total_amount` to the customer's `current_due`. However, because the payments were inserted directly into `account_transactions` (instead of creating a separate `'payment_in'` transaction), the trigger **never sees the payment**.
- **The Result:** If a customer buys ৳1,000 worth of goods and pays ৳1,000 in full at the POS, their ledger will incorrectly state they still owe ৳1,000. Every POS sale acts as a "100% Due Sale" against the customer's ledger, completely ignoring any payments made at checkout.

---

## Conclusion
The POS checkout flow cannot be used in its current state. The API layer fails to calculate secure totals and invoke the RPC correctly, and the underlying database triggers fail to correctly deduct inline POS payments from the customer's ledger due balance.
