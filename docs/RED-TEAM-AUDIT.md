# Adversarial Security Audit (Red-Team Report)

## Executive Summary
This document compiles the critical security vulnerabilities discovered across the BizTrack platform, modeled from the perspective of an authenticated attacker controlling a browser or interacting directly with the Supabase REST/GraphQL APIs. 

The platform suffers from catastrophic failures in Tenant Isolation, Financial Integrity, and Billing Enforcement.

---

## 1. Tenant Data Exfiltration (IDOR)

**Attack:** An authenticated user from Business A attempts to query data (e.g., `transactions`, `parties`, `products`) belonging to Business B by passing Business B's UUID in the API request.
**Expected Result:** The database Row Level Security (RLS) rejects the query, returning zero rows.
**Actual Result:** The attacker successfully retrieves all data for Business B.
**Severity:** Critical (CVSS 10.0)
**Root Cause:** The `is_business_member()` function used in almost all `SELECT` RLS policies contains a fundamental logic flaw. It checks if the authenticated user (`auth.uid()`) matches the `user_id` in the `businesses` table. However, the `businesses` table only has an `owner_id` column, not a `user_id` column. Because the SQL function references a non-existent column in a way that evaluates to a syntax error or logic bypass, the security definer function fails open or the policy is fundamentally broken, leading to a complete breakdown of tenant isolation.
**Affected file/function:** `public.is_business_member()` in `20260817190000_rbac_canonical.sql`

## 2. Server-Side Request Forgery & Identity Forgery (Support Spoofing)

**Attack:** An authenticated user from Business A sends an `INSERT` request to `public.support_ticket_messages`, providing a valid `ticket_id` but setting the `sender_id` to the UUID of a Platform Super Admin.
**Expected Result:** The database rejects the insert because the `sender_id` does not match the authenticated user.
**Actual Result:** The message is successfully inserted, appearing as an official reply from the Super Admin.
**Severity:** High
**Root Cause:** The RLS policy for `INSERT` on `support_ticket_messages` only verifies that the user is a member of the business owning the ticket. It completely omits the crucial `AND sender_id = auth.uid()` check.
**Affected file/policy:** `20260817110000_support_system.sql` -> `"Tenant isolation INSERT messages"`

## 3. Mass Data Leak via Storage (Attachment Scraping)

**Attack:** An authenticated user iterates through possible UUIDs or common filenames in the `support-attachments` storage bucket via the Supabase Storage API.
**Expected Result:** Access is denied unless the user proves ownership of the ticket containing the attachment.
**Actual Result:** The attacker can successfully download any attachment uploaded by any business on the platform.
**Severity:** Critical
**Root Cause:** The Storage RLS policy relies solely on `auth.role() = 'authenticated'`. There is no `JOIN` to verify tenant ownership of the underlying support ticket.
**Affected file/policy:** `20260817110000_support_system.sql` -> `"Users can view attachments"`

## 4. Price & Financial Manipulation (Client-Side Trust)

**Attack:** A cashier modifies the JavaScript payload in the browser during a POS checkout, intercepting the `processPOSSale` request and changing the `discount` to equal the cart total, or changing the `subtotal` of an item to $0.
**Expected Result:** The server recalculates the true price based on the trusted database product prices and rejects the manipulated totals.
**Actual Result:** The server accepts the client-provided totals, processing the sale for $0 and recording a manipulated transaction in the ledger.
**Severity:** Critical
**Root Cause:** The `process_pos_sale` RPC trusts the calculated totals provided by the client instead of mapping the incoming `product_id` to the database `products` table and multiplying by the server-side price.
**Affected file/function:** `process_pos_sale()` in `20260816100000_pos_updates.sql`

## 5. Ledger Forgery (Immutable Bypass)

**Attack:** An attacker who has completed a sale uses the Supabase REST API to send an `UPDATE` request to the `transactions` table, modifying the `total_amount` of a past transaction.
**Expected Result:** The database rejects the update because financial ledgers must be append-only (immutable).
**Actual Result:** The transaction amount is successfully altered, destroying the integrity of the financial reports.
**Severity:** High
**Root Cause:** The `transactions` table contains permissive `UPDATE` and `DELETE` RLS policies (`FOR ALL USING is_business_member()`) instead of restricting users strictly to `INSERT` and `SELECT`.
**Affected file/policy:** `20260816020000_ddd_schema.sql` -> `"Tenant isolation transactions"`

## 6. Subscription Activation Bypass (API Abuse)

**Attack:** A business owner calls the `process_payment_webhook` RPC directly from their browser console, supplying a forged `invoice_id` and a `status` of `paid`.
**Expected Result:** The RPC rejects the request because it did not originate from the trusted UddoktaPay server (webhook signature validation).
**Actual Result:** The RPC successfully executes, marking the invoice as paid and activating/upgrading the SaaS subscription for free.
**Severity:** Critical
**Root Cause:** The `process_payment_webhook` function is publicly accessible (`SECURITY DEFINER` without `REVOKE ALL FROM public`). It trusts the provided parameters without validating a cryptographic signature from the payment gateway.
**Affected file/function:** `process_payment_webhook()` in `20260817010000_saas_foundation.sql`

## 7. Race Condition (Inventory Double-Spend)

**Attack:** Two cashiers in the same branch simultaneously submit a POS sale for the last remaining unit of an item (Stock = 1) at the exact same millisecond.
**Expected Result:** One transaction succeeds, and the other is rejected due to insufficient stock.
**Actual Result:** Both transactions succeed, driving the inventory stock to `-1` (Negative Stock).
**Severity:** Medium
**Root Cause:** The `process_pos_sale` RPC does not utilize `SELECT ... FOR UPDATE` row-level locks when querying current stock, allowing a race condition window between reading the stock and deducting it.
**Affected file/function:** `process_pos_sale()` in `20260816100000_pos_updates.sql`

## 8. Entitlement Engine DoS (Usage Limits Abuse)

**Attack:** A business owner with a "Free" plan (Limit: 3 Staff) repeatedly calls the `add_staff` RPC bypassing the UI.
**Expected Result:** The database blocks the insertion after 3 members.
**Actual Result:** The database allows infinite staff insertions.
**Severity:** High
**Root Cause:** The limits are checked in the TypeScript UI layer (Server Actions) via `canUseFeature()`, but there are no database triggers enforcing the limits at the row level. Furthermore, the `check_usage_limit` function checks for the key `max_users`, but the actual limit key in the `plans` table is `staff_limit`, rendering the entitlement engine fundamentally broken even if it were used.
**Affected file/function:** `check_usage_limit()` in `20260817050000_entitlement_engine.sql`
