# Multi-Tenant Isolation Audit Report

## Overview
BizTrack BD relies on PostgreSQL Row Level Security (RLS) to enforce multi-tenant isolation via the `public.is_business_member()` function, which checks if the authenticated user (`auth.uid()`) holds a record in `business_members` for the queried `business_id`.

While top-level entity access (e.g., viewing businesses, parties, products) is correctly isolated, **several critical Insecure Direct Object Reference (IDOR) vulnerabilities and cross-tenant data corruption vectors exist at the relational and trigger levels.**

---

## Isolation Failures (Cross-Tenant Vulnerabilities)

### 1. Cross-Tenant Inventory Manipulation
**Vulnerability:** A user in Business A can arbitrarily modify the stock levels of products in Business B.
**Mechanism:** 
- The `inventory_movements` table RLS policy only checks if the user is a member of the `business_id` being inserted: `CHECK (public.is_business_member(business_id))`.
- It **does not** verify if the `product_id` belongs to the same `business_id`.
- The `set_inventory_movement_balances()` trigger runs as `SECURITY DEFINER` and blindly updates `current_stock` on the `products` table using the provided `product_id`.
**Exploit:** User A inserts a movement with `business_id` = A, `quantity` = -1000, and `product_id` = (Business B's Product ID). Business B's stock is instantly drained.

### 2. Cross-Tenant Financial Account Poisoning
**Vulnerability:** A user in Business A can artificially inflate or drain the bank/cash accounts of Business B.
**Mechanism:**
- The `account_transactions` table RLS policy only validates that the parent `transaction_id` belongs to a transaction owned by the user's business: `CHECK (EXISTS (SELECT 1 FROM transactions WHERE id = transaction_id AND is_business_member(business_id)))`.
- It **does not** verify if the `account_id` being linked actually belongs to the user's business.
**Exploit:** User A creates a valid transaction in Business A, then inserts an `account_transaction` linking their transaction to Business B's `account_id` with a negative amount. Because dashboard metrics aggregate `account_transactions` joined to `accounts` matching the business ID, Business B's available cash drops.

### 3. Cross-Tenant Sales & Party Ledger Corruption
**Vulnerability:** A user in Business A can attribute sales to customers/suppliers belonging to Business B, corrupting Business B's due/payable reports.
**Mechanism:**
- The `transactions` table RLS policy verifies `is_business_member(business_id)`.
- There is no database constraint or trigger ensuring that `transactions.party_id` belongs to the same business as `transactions.business_id`.
**Exploit:** User A creates a transaction with their own `business_id` but passes Business B's `party_id`. When Business B queries their total customer dues (which filters by `party_id IN (their parties)`), the rogue transaction alters their financial totals.

### 4. Cross-Tenant Transaction Item Leakage
**Vulnerability:** A user in Business A can link Business B's products to their own sales receipts.
**Mechanism:**
- Similar to `account_transactions`, the `transaction_items` RLS policy only checks ownership of the parent `transaction_id`.
- It does not verify if the `product_id` being sold actually belongs to the business.

### 5. Branch Data Isolation Failure (Intra-Tenant Leak)
**Vulnerability:** Branch A staff can view and modify Branch B's data (transactions, inventory, daily closings).
**Mechanism:**
- The `branches` architecture exists, but RLS policies globally grant access based on `business_id`. 
- There is no `user_branch` mapping table or RLS policy that restricts a cashier's access to their specific `branch_id`.
- If a cashier logs in, they are a `business_member` and thus inherently granted read/write access to *all* branches under that business.

---

## Recommended Remediation Architecture

To secure the SaaS, the following changes must be implemented:

1. **Foreign Key Business Scoping:**
   Composite foreign keys must be introduced to guarantee relational integrity.
   For example, `transaction_items` should reference `(business_id, product_id)` instead of just `product_id`, ensuring cross-tenant linking is impossible at the database engine level.

2. **Trigger Hardening:**
   All `SECURITY DEFINER` triggers (like `set_inventory_movement_balances`) must assert that the target entity's `business_id` matches the triggering entity's `business_id` before executing mutations.

3. **Branch-Level RBAC:**
   A `member_branches` table or an array column must be added to `business_members` to track which branches a user is authorized to access, with RLS policies updated to enforce `branch_id` scoping for non-owners.
