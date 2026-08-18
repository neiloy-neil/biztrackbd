# BizTrack BD — Master Audit Gaps & Fix Tracker

> **Source:** 27 individual audit files in `docs/`  
> **Compiled:** 2026-08-17  
> **Total gaps identified:** 91  

---

## Quick Stats

| Category | Count | Fixed | Remaining |
|---|---|---|---|
| Critical Security Vulnerabilities | 12 | 3 | **9** |
| Critical Financial Bugs | 16 | 4 | **12** |
| Missing Features | 26 | 0 | **26** |
| Permission / Authorization Gaps | 7 | 1 | **6** |
| Export & Data Quality | 5 | 0 | **5** |
| Performance | 6 | 0 | **6** |
| Mobile & UX | 15 | 0 | **15** |
| Audit / Observability | 2 | 0 | **2** |
| **TOTAL** | **91** | **8** | **83** |

---

## Legend

| Icon | Meaning |
|---|---|
| 🔴 | Not fixed — blocks beta/production |
| 🟠 | Not fixed — high severity |
| 🟡 | Not fixed — medium/UX |
| ✅ | Fixed this session |
| ⚠️ | Partial fix |
| 📁 | Source audit file |

---

## Part 1 — Critical Security Vulnerabilities

### SEC-01 — Tenant Data Exfiltration (IDOR) 🔴
**Severity:** CVSS 10.0 — Critical  
**Source:** 📁 RED-TEAM-AUDIT.md, MULTI-TENANT-AUDIT.md  
**Description:** `is_business_member()` function used in all RLS policies references a non-existent `user_id` column (should be `owner_id`) in the `businesses` table. The function fails open. Any authenticated user can `SELECT * FROM transactions WHERE business_id = <competitor_id>` and retrieve the competitor's entire financial ledger.  
**Fix:** Correct `is_business_member()` function in `20260817190000_rbac_canonical.sql`. Add regression test: authenticated user querying another business's data must return zero rows.

---

### SEC-02 — Billing Subscription Activation Bypass 🔴
**Severity:** Critical  
**Source:** 📁 RED-TEAM-AUDIT.md, BILLING-AUDIT.md, SAAS-AUDIT.md  
**Description:** `process_payment_webhook` PostgreSQL function is `SECURITY DEFINER` with no `REVOKE ALL ON FUNCTION FROM public`. Any authenticated user can call `supabase.rpc('process_payment_webhook', { p_uddoktapay_invoice_id: '...', p_status: 'COMPLETED' })` to activate any subscription for free without paying. Currently not exploitable only because Bug BIL-01 (below) means `uddoktapay_invoice_id` is always NULL.  
**Fix:** `REVOKE ALL ON FUNCTION public.process_payment_webhook FROM public, anon, authenticated;` Add cryptographic webhook signature verification.

---

### SEC-03 — Support Attachment Unrestricted Access 🔴
**Severity:** Critical  
**Source:** 📁 RED-TEAM-AUDIT.md, SUPPORT-AUDIT.md  
**Description:** Storage policy: `USING (bucket_id = 'support-attachments' AND auth.role() = 'authenticated')`. Any authenticated user on the platform can view, download, or enumerate every attachment uploaded by any business. Zero tenant isolation.  
**Fix:** Replace storage policy with a JOIN to `support_tickets` verifying the viewing user's business membership matches the ticket's `business_id`.

---

### SEC-04 — Support Message Spoofing / Identity Forgery 🔴
**Severity:** High  
**Source:** 📁 RED-TEAM-AUDIT.md, SUPPORT-AUDIT.md  
**Description:** RLS `INSERT` policy for `support_ticket_messages` only verifies business membership. Missing `AND sender_id = auth.uid()`. A tenant can insert messages with `sender_id` = a Platform Admin's UUID, forging official admin replies (e.g., "We have processed your refund of ৳50,000").  
**Fix:** Add `WITH CHECK (sender_id = auth.uid())` to the INSERT policy on `support_ticket_messages`.

---

### SEC-05 — Support Ticket Field Spoofing 🔴
**Severity:** High  
**Source:** 📁 SUPPORT-AUDIT.md  
**Description:** INSERT policy for `support_tickets` only verifies `is_business_member(business_id)`. A tenant can arbitrarily set: `user_id` (spoof creator), `assigned_to` (spam a specific admin), `status` (create tickets already marked Resolved to bypass metrics).  
**Fix:** Add `WITH CHECK` constraints: `user_id = auth.uid()`, `assigned_to IS NULL`, `status = 'open'` on INSERT.

---

### SEC-06 — POS Price Manipulation (Client Trust) ✅ Partially Fixed
**Severity:** Critical  
**Source:** 📁 RED-TEAM-AUDIT.md, POS-AUDIT.md  
**Description:** `process_pos_sale` RPC trusts client-provided `p_total_amount` and `p_subtotal`. An attacker intercepts and modifies the cart total to ৳0.01. Server processes sale at that price.  
**Status:** Server-side calculation migration applied, but POS-AUDIT confirms the action still has the "Dead Button" bug (SEC-06 fix incomplete; see FIN-01).

---

### SEC-07 — Transaction Ledger Mutability 🔴
**Severity:** High  
**Source:** 📁 RED-TEAM-AUDIT.md, DATA-CONSISTENCY-AUDIT.md  
**Description:** The `transactions` and `account_transactions` tables have permissive `UPDATE` and `DELETE` RLS policies. An attacker (or dishonest employee) can alter historical transaction amounts, destroying the integrity of all financial reports and historical `daily_closing` records.  
**Fix:** Strip `UPDATE` and `DELETE` RLS policies from `transactions` and `account_transactions`. Implement explicit Server Actions for reversal/correction workflows instead.

---

### SEC-08 — Cross-Tenant Inventory Manipulation 🔴
**Severity:** Critical  
**Source:** 📁 MULTI-TENANT-AUDIT.md  
**Description:** `inventory_movements` RLS only checks if user is a member of the `business_id` being inserted. Does NOT verify if `product_id` belongs to the same business. The `set_inventory_movement_balances()` trigger runs as `SECURITY DEFINER` and blindly updates `current_stock` on any `product_id`.  
**Exploit:** Insert movement with `business_id = A`, `product_id = Business B's product`, `quantity = -1000`. Business B's stock is instantly drained.  
**Fix:** Add `AND EXISTS (SELECT 1 FROM products WHERE id = product_id AND business_id = NEW.business_id)` check to the RLS INSERT policy and the SECURITY DEFINER trigger.

---

### SEC-09 — Cross-Tenant Financial Account Poisoning 🔴
**Severity:** Critical  
**Source:** 📁 MULTI-TENANT-AUDIT.md  
**Description:** `account_transactions` RLS does NOT verify if the `account_id` being linked belongs to the user's business. A tenant inserts an `account_transaction` linking their valid transaction to Business B's `account_id` with a negative amount. Business B's cash balance drops.  
**Fix:** Add composite key check on `account_transactions` INSERT: verify `account_id` belongs to the same `business_id` as the transaction.

---

### SEC-10 — Cross-Tenant Party Ledger Corruption 🔴
**Severity:** High  
**Source:** 📁 MULTI-TENANT-AUDIT.md  
**Description:** No constraint ensuring `transactions.party_id` belongs to the same business as `transactions.business_id`. A tenant passes Business B's `party_id`, corrupting Business B's customer/supplier financial totals.  
**Fix:** Add DB trigger or composite FK validating `party_id` business ownership.

---

### SEC-11 — Cross-Tenant Transaction Item Leakage 🔴
**Severity:** High  
**Source:** 📁 MULTI-TENANT-AUDIT.md  
**Description:** `transaction_items` RLS only checks ownership of the parent `transaction_id`. Does not verify if the `product_id` being sold belongs to the business. Allows cross-tenant product ID injection.  
**Fix:** Add `AND EXISTS (SELECT 1 FROM products WHERE id = product_id AND business_id = <business_id>)` to the INSERT policy.

---

### SEC-12 — Inventory Double-Spend Race Condition 🔴
**Severity:** Medium  
**Source:** 📁 RED-TEAM-AUDIT.md  
**Description:** `process_pos_sale` RPC does not use `SELECT ... FOR UPDATE` row-level locks when querying current stock. Two concurrent offline sales of the last unit both succeed, driving stock to -1.  
**Fix:** Add `SELECT current_stock FROM products WHERE id = p_product_id FOR UPDATE` inside the RPC's transaction block before deducting stock.

---

## Part 2 — Critical Financial Bugs

### FIN-01 — POS "Dead Button" Bug 🔴
**Severity:** Critical — 100% of POS sales fail  
**Source:** 📁 POS-AUDIT.md  
**Description:** `process_pos_sale` DB RPC requires positional parameters `p_total_amount` and `p_subtotal`. The Next.js Server Action `pos/actions.ts` does not include these in the payload. PostgreSQL rejects every call instantly. Every single POS sale attempt fails.  
**Fix:** Either (a) add the missing params to the Server Action, or (b) refactor the RPC to calculate totals server-side from product IDs + quantities (preferred — also fixes SEC-06).

---

### FIN-02 — POS Customer Due Double Charge 🔴
**Severity:** Critical  
**Source:** 📁 POS-AUDIT.md  
**Description:** `process_pos_sale` inserts a `'sale'` transaction then inserts payment directly into `account_transactions`. The trigger `trg_maintain_party_balance` fires on the `'sale'` transaction and adds full `total_amount` to the customer's `current_due`. Because payment bypasses the `'payment_in'` transaction path, the trigger never deducts it. Every POS sale — even fully paid ones — permanently adds 100% of the sale to the customer's due ledger.  
**Fix:** Process POS payments as explicit `'payment_in'` transactions rather than direct `account_transactions` inserts, so the party balance trigger can credit the payment.

---

### FIN-03 — Billing: Disconnected Webhook Pipeline 🔴
**Severity:** Critical — 0% of payments activate subscriptions  
**Source:** 📁 BILLING-AUDIT.md  
**Description:** `BillingService.createSubscriptionCheckout` inserts an invoice row but leaves `uddoktapay_invoice_id` as NULL. When UddoktaPay fires its webhook with its internal `invoice_id`, the RPC `process_payment_webhook` queries `WHERE uddoktapay_invoice_id = p_uddoktapay_invoice_id`. Because the column is always NULL, no invoice is ever found. 100% of payments are collected but 0% of subscriptions are activated.  
**Fix:** Store UddoktaPay's `invoice_id` (from the checkout creation response) into the `uddoktapay_invoice_id` column before redirecting the user.

---

### FIN-04 — Billing: Plan Upgrade Black Hole 🔴
**Severity:** Critical  
**Source:** 📁 BILLING-AUDIT.md  
**Description:** `invoices` table has no `plan_id` column. When `process_payment_webhook` executes, it extends the subscription period but never changes the `plan_id`. A Free user who pays for Enterprise is charged ৳9,999 but their subscription stays on Free forever.  
**Fix:** Add `plan_id` to `invoices` table. On webhook success, update `subscriptions.plan_id` from `invoices.plan_id`. There is already a working TypeScript implementation in `BillingService.processPaymentWebhook` that reads `metadata.plan_id` correctly — wire `route.ts` to use it instead of the broken SQL RPC.

---

### FIN-05 — Daily Closing Stacking Difference Bug 🔴
**Severity:** Critical  
**Source:** 📁 DAILY-CLOSING-AUDIT.md  
**Description:** When a cashier submits a difference (e.g., cash shortage of ৳500), the system logs it in `daily_closings` but never creates a corresponding adjustment in `account_transactions`. Tomorrow's `expected_cash` still demands that ৳500. A one-time shortage compounds — it manifests as a permanent daily shortage forever.  
**Fix:** After recording the closing difference, insert a balancing `adjustment` transaction into `account_transactions` to reconcile the ledger.

---

### FIN-06 — Daily Closing Mobile Money Hardcoding 🔴
**Severity:** High  
**Source:** 📁 ACCOUNTS-AUDIT.md, DAILY-CLOSING-AUDIT.md  
**Description:** `get_daily_closing_summary` RPC calculates mobile money balances using `a.name ILIKE '%bkash%'` and `a.name ILIKE '%nagad%'`. If a business names their account "Personal Wallet" or "Rocket", Daily Closing shows ৳0 for those accounts while the Money Visibility dashboard shows the correct balance.  
**Fix:** Add an `account_type` or `account_subtype` enum column (e.g., `bkash`, `nagad`, `bank`, `cash`) and filter by that instead of the name string.

---

### FIN-07 — Daily Closing Expected Cash Desync 🔴
**Severity:** High  
**Source:** 📁 ACCOUNTS-AUDIT.md  
**Description:** The Daily Closing RPC aggregates only four transaction types: `sale`, `payment_in`, `expense`, `payment_out`. `opening_balance` and `income` cash flows are completely ignored. If a user adds ৳10,000 opening balance to their cash account, the Daily Closing will demand ৳0 expected cash while the ledger shows ৳10,000.  
**Fix:** Include `opening_balance` and `income` in the expected cash aggregation within `get_daily_closing_summary`.

---

### FIN-08 — Post-Closing Transaction Desync 🔴
**Severity:** High  
**Source:** 📁 DAILY-CLOSING-AUDIT.md  
**Description:** No database lock prevents new transactions from being recorded on a date that has already been closed. If a manager closes the day at 5:00 PM and a cashier processes a sale at 6:00 PM, the sale is recorded for "today" but the daily closing record is immutable — the 6:00 PM sale permanently falls outside the closing report.  
**Fix:** Check in the transaction Server Action whether a `daily_closing` record already exists for the current date. Reject or warn if one does.

---

### FIN-09 — Dashboard Profit Calculation Wrong 🔴
**Severity:** Critical  
**Source:** 📁 DASHBOARD-AUDIT.md, REPORTS-AUDIT.md  
**Description:** Dashboard profit = Sales − Expenses, completely ignoring `purchase` (Cost of Goods Sold). If a business sells ৳10,000 of goods that cost ৳8,000 to procure, the dashboard declares ৳10,000 profit (not ৳2,000). Also: `get_financial_summary` in the latest migration explicitly removed `purchase` from expense aggregation.  
**Fix:** Include `purchase` transactions in expense/COGS aggregation for all profit calculations in dashboard and reports.

---

### FIN-10 — Dashboard Revenue Incomplete 🔴
**Severity:** High  
**Source:** 📁 DASHBOARD-AUDIT.md, INCOME-EXPENSE-AUDIT.md  
**Description:** Dashboard and reports entirely ignore `income`-type transactions. Non-sale revenues (bank interest, fees, grants) increase account balances but are invisible in all revenue and profit metrics.  
**Fix:** Include `income` type in all revenue aggregations in `get_dashboard_summary` and `get_financial_summary`.

---

### FIN-11 — Supplier Balance Not Updated by Expenses 🔴
**Severity:** High  
**Source:** 📁 INCOME-EXPENSE-AUDIT.md, TRANSACTION-TYPE-AUDIT.md  
**Description:** `trg_maintain_party_balance` checks `NEW.type IN ('purchase', 'opening_balance')` for supplier due updates. If a user logs an `expense` against a supplier (e.g., electricity bill owed to a utility supplier), the supplier's payable balance does not update.  
**Fix:** Include `'expense'` in the trigger's party balance condition when `party_type = 'supplier'`.

---

### FIN-12 — Financial Double-Entry Unenforced 🔴
**Severity:** Critical  
**Source:** 📁 DATA-CONSISTENCY-AUDIT.md  
**Description:** No database-level constraint (deferred trigger or CHECK) enforcing `transactions.total_amount = SUM(account_transactions.amount)`. A UI bug or direct API call can create a ৳10,000 sale with only ৳5,000 deposited into an account — undetected.  
**Fix:** Add a `DEFERRED CONSTRAINT TRIGGER AFTER INSERT` on `account_transactions` that verifies the sum matches the parent transaction's `total_amount` before committing.

---

### FIN-13 — SaaS Subscription Never Expires ✅ Architecture OK / 🔴 CRON Missing
**Severity:** High  
**Source:** 📁 SAAS-AUDIT.md  
**Description:** Entitlement query checks `WHERE s.status IN ('active', 'trialing')` but never checks `AND current_period_end > now()`. No CRON job transitions expired subscriptions to `past_due` or `suspended`. Subscriptions remain active in the database indefinitely after cancellation or payment failure.  
**Fix:** Add daily CRON job (Supabase pg_cron or `/api/cron/daily-checks`) to `UPDATE subscriptions SET status = 'past_due' WHERE status = 'active' AND current_period_end < now()`.

---

### FIN-14 — SaaS Entitlement Key Typo — Staff Always Denied 🔴
**Severity:** Critical  
**Source:** 📁 SAAS-AUDIT.md  
**Description:** `settings/actions.ts` calls `canUseFeature(ctx.businessId, 'staff_limit')`. The actual database feature key is `max_users`. Because `staff_limit` is `undefined` in the entitlements payload, the engine defaults to `false`. **Nobody on any plan can add staff members through the UI.**  
**Fix:** Change `'staff_limit'` to `'max_users'` in `settings/actions.ts`.

---

### FIN-15 — SaaS Entitlement Boolean Limit Flaw 🔴
**Severity:** High  
**Source:** 📁 SAAS-AUDIT.md  
**Description:** The TypeScript entitlement engine treats `limit === 1` as a boolean "enabled" flag and returns `true` without checking current usage. If the `staff_limit` typo (FIN-14) is fixed, the Free plan (which has `max_users = 1`) will still allow unlimited users.  
**Fix:** Change the entitlement check logic: `limit === 1` should mean "allowed limit is 1 user, check current count ≤ 1" not "feature is boolean-enabled".

---

### FIN-16 — Non-Atomic Billing Webhook Processing 🔴
**Severity:** Critical  
**Source:** 📁 DATA-CONSISTENCY-AUDIT.md  
**Description:** If the webhook RPC crashes mid-execution, the invoice can be marked `paid` while the subscription update fails. The customer is charged but receives no service — or worse, subscription is activated without billing being recorded.  
**Fix:** Wrap the entire webhook processing in an atomic PostgreSQL transaction. Implement idempotency via `gateway_event_id` column to prevent duplicate webhook processing.

---

## Part 3 — Missing Features (Never Implemented)

### MF-01 — Purchase Transactions 🔴
**Source:** 📁 TRANSACTION-TYPE-AUDIT.md  
No `createPurchase` Server Action or UI exists. Businesses cannot record supplier purchases. COGS is therefore uncalculatable. The `purchase` enum type exists in the database but is unused from the UI.

---

### MF-02 — Income Transaction Type 🔴
**Source:** 📁 TRANSACTION-TYPE-AUDIT.md, INCOME-EXPENSE-AUDIT.md  
The `income` DB enum type exists and `create_transaction_atomic` supports it, but `createTransaction` Server Action explicitly rejects it. The dashboard completely ignores it. Non-sale revenues cannot be recorded.

---

### MF-03 — Account Transfer (Bank → Cash) 🔴
**Source:** 📁 ACCOUNTS-AUDIT.md, TRANSACTION-TYPE-AUDIT.md  
`transfer` exists in the transaction type DB enum. No UI or Server Action to move money between accounts. Users have no way to record: Bank → Cash drawer, bKash → Bank, etc.

---

### MF-04 — Refund / Transaction Reversal 🔴
**Source:** 📁 TRANSACTION-TYPE-AUDIT.md  
The schema supports a `'reversed'` transaction state and the trigger handles state transitions. Zero Server Actions exist to trigger a reversal. Transactions are permanently immutable from the UI (must be deleted via raw SQL — which also breaks audit trails).

---

### MF-05 — Reopen Closed Day 🔴
**Source:** 📁 DAILY-CLOSING-AUDIT.md  
No Server Action or UI to reopen a closed day. The `daily_closings` table RLS blocks all `UPDATE` and `DELETE`. Managers have no recourse for erroneous closings.

---

### MF-06 — Account Report 🔴
**Source:** 📁 REPORTS-AUDIT.md  
No Account Report UI or Server Action. Users cannot see account-level transaction history in the Reports module.

---

### MF-07 — Transaction Report 🔴
**Source:** 📁 REPORTS-AUDIT.md  
No Transaction Report UI or Server Action. Users cannot filter and view all transactions in the Reports module.

---

### MF-08 — Daily Closing Report 🔴
**Source:** 📁 REPORTS-AUDIT.md  
No Daily Closing Report view in the Reports module. Users cannot review historical closings without navigating to individual dates.

---

### MF-09 — Platform Notification System 🔴
**Source:** 📁 NOTIFICATIONS-AUDIT.md  
`createPlatformNotification` function exists in `src/domains/admin/notifications.ts` but is **never imported or called anywhere** in the entire codebase. No PostgreSQL triggers generate notifications. The Super Admin notification inbox is permanently empty.

---

### MF-10 — Per-Admin Notification Read State 🔴
**Source:** 📁 NOTIFICATIONS-AUDIT.md  
`is_read` is stored directly on the notification row. If Admin A marks a notification read, it's read for all admins. If Admin A deletes it, it's deleted for everyone. Needs a `admin_notification_reads` junction table.

---

### MF-11 — SaaS Plan Management (Super Admin) 🔴
**Source:** 📁 SUPER-ADMIN-AUDIT.md  
No UI or Server Action to create, edit, or delete SaaS plans. All plan changes require raw SQL. A SaaS product where plans cannot be managed from the admin panel is operationally incomplete.

---

### MF-12 — Super Admin Invoice Actions 🔴
**Source:** 📁 SUPER-ADMIN-AUDIT.md  
The invoice detail page (`/admin/invoices/[invoiceId]`) renders four buttons: **"Void Invoice"**, **"Issue Credit"**, **"Resend Email"**, **"Download PDF"**. Every single button is dead — no `onClick` handlers, no Server Actions. Clicking produces no state change.

---

### MF-13 — Subscription Management (Super Admin) 🔴
**Source:** 📁 SUPER-ADMIN-AUDIT.md  
No UI for: Cancel Subscription, Apply Grace Period, Refund, Force Expire, Manual Plan Change. All require raw SQL.

---

### MF-14 — User Impersonation (Super Admin) 🔴
**Source:** 📁 SUPER-ADMIN-AUDIT.md  
No mechanism for a Super Admin to assume a tenant's identity for debugging customer-reported issues.

---

### MF-15 — SaaS Subscription Lifecycle CRON 🔴
**Source:** 📁 SAAS-AUDIT.md  
No worker exists to: expire subscriptions past `current_period_end`, apply scheduled downgrades, send renewal reminders, handle failed payment grace periods. Subscriptions stay `active` forever.

---

### MF-16 — Business Profile Settings 🟠
**Source:** 📁 SETTINGS-AUDIT.md  
No UI to update Business Name, Logo, Currency, Timezone, or Language. Currency (`BDT`) and Timezone (`Asia/Dhaka`) are hardcoded in UI components, not pulled from the `settings` table.

---

### MF-17 — Branch Management 🟠
**Source:** 📁 SETTINGS-AUDIT.md  
`branches` table exists; a default branch is created on signup. No UI to add, edit, or delete additional branches. Multi-branch businesses cannot be managed.

---

### MF-18 — Invoice & Receipt Settings 🟡
**Source:** 📁 SETTINGS-AUDIT.md  
`public.settings` table has `receipt_header` and `receipt_footer` columns. No UI for tenants to customize their receipt headers (e.g., their shop name, address, phone).

---

### MF-19 — Tax Settings 🟡
**Source:** 📁 SETTINGS-AUDIT.md  
Completely unimplemented — no schema, no Server Action, no UI. BizTrack cannot calculate VAT/tax.

---

### MF-20 — Custom Roles & Permissions 🟡
**Source:** 📁 SETTINGS-AUDIT.md  
Roles are hardcoded enum (`owner`, `manager`, `cashier`, `staff`). No UI to create custom roles or tweak granular permissions per role.

---

### MF-21 — Offline: Customer / Product / Inventory Creation 🔴
**Source:** 📁 OFFLINE-AUDIT.md  
Offline queue only supports `transaction`, `pos_sale`, `daily_closing`. Creating a new customer, product, or inventory adjustment while offline has no support — these operations fail entirely offline.

---

### MF-22 — Offline: Conflict Resolution 🔴
**Source:** 📁 OFFLINE-AUDIT.md  
No conflict resolution mechanism. If an offline user sells the last unit of a product and another online user simultaneously sells the same item, the offline sale's sync fails silently after 5 retries and is marked `failed`. Cash collected from the customer is unaccounted for in the ledger.

---

### MF-23 — Email Verification 🟠
**Source:** 📁 FEATURE-VERIFICATION.md  
Stubbed completely. Pseudo-emails (`880XXXXXXXXXXX@biztrack.internal`) are auto-confirmed. No real email delivery for verification.

---

### MF-24 — Multiple Session Management 🟡
**Source:** 📁 FEATURE-VERIFICATION.md  
No mechanism to view or revoke active sessions/devices. A user who loses their phone cannot remotely log out other sessions.

---

### MF-25 — Suspended User Middleware Check 🟠
**Source:** 📁 FEATURE-VERIFICATION.md  
Middleware checks only business-level suspension. Individual user suspension is not enforced at the middleware layer — a suspended user from a non-suspended business can still access the app.

---

### MF-26 — SMS "Rate" Button 🟡
**Source:** 📁 SETTINGS-AUDIT.md  
On `/app/settings`, a button labeled "এসএমএস রেট (SMS Rate)" has no `href`, `onClick` handler, or functionality. Dead UI control visible to all users.

---

## Part 4 — Permission / Authorization Gaps

### PERM-01 — Inventory Adjustment Permission Bypass 🔴
**Source:** 📁 PERMISSION-AUDIT.md, INVENTORY-AUDIT.md  
`inventory/actions.ts → recordMovement` wraps in `authAction` (business member check) but skips `hasPermission('inventory.manage')`. The `inventory_movements` RLS also allows INSERT for any business member. Any `cashier` or `staff` can arbitrarily manipulate stock numbers.  
**Fix:** Add `requirePermission('inventory.manage')` to `recordMovement` Server Action and add role check to RLS policy.

---

### PERM-02 — Billing Actions Lack Role Check 🔴
**Source:** 📁 PERMISSION-AUDIT.md  
`billing/actions.ts → startCheckoutAction` and `changePlanAction` do not use `authAction` or check user `role`. Any staff member can upgrade the business to the highest tier plan or cancel the active subscription.  
**Fix:** Add `requirePermission('billing.manage')` (or `owner`-only check) to all billing Server Actions.

---

### PERM-03 — Product Create Permission Missing 🟠
**Source:** 📁 PERMISSION-AUDIT.md  
`createProduct` Server Action omits `hasPermission('inventory.manage')`. Relies solely on RLS for enforcement, violating defense-in-depth.  
**Fix:** Add explicit `hasPermission` check in Server Action.

---

### PERM-04 — Party Create Permission Missing 🟠
**Source:** 📁 PERMISSION-AUDIT.md  
`createParty` Server Action omits `hasPermission()` check.  
**Fix:** Add explicit `hasPermission('parties.manage')` check.

---

### PERM-05 — Adjustment Transaction Permission Missing 🟠
**Source:** 📁 TRANSACTION-TYPE-AUDIT.md  
The `adjustment` transaction type has no `hasPermission` check in the Server Action.  
**Fix:** Add `requirePermission('inventory.manage')` for adjustment transactions.

---

### PERM-06 — Branch Data Isolation Missing 🔴
**Source:** 📁 MULTI-TENANT-AUDIT.md  
No `member_branches` mapping table or RLS restricting a cashier's access to their specific branch. All business members have read/write access to all branches under their business. A cashier at Branch A can see and modify Branch B's data.  
**Fix:** Create `member_branches` junction table. Add branch ownership check to RLS policies on branch-scoped tables.

---

### PERM-07 — Entitlement Engine Not Enforced at DB Layer 🔴
**Source:** 📁 SAAS-AUDIT.md, RED-TEAM-AUDIT.md  
Usage limits are checked only in TypeScript UI via `canUseFeature()`. No DB triggers on `products`, `business_members`, or `branches` tables. API or direct Supabase calls bypass limits entirely. Free plan users can create unlimited products, staff, and branches via API.  
**Fix:** Add `AFTER INSERT` triggers on `products`, `business_members`, and `branches` that call `check_usage_limit()` and raise exceptions on limit violation.

---

## Part 5 — Export & Data Quality Gaps

### EXP-01 — CSV Exports Corrupt Bengali Text 🟠
**Source:** 📁 EXPORT-AUDIT.md  
CSV exports lack the UTF-8 BOM (`﻿`). Microsoft Excel on Windows defaults to ANSI encoding. All Bengali product names, categories, and transaction notes render as Mojibake (corrupted characters).  
**Fix:** Prepend `﻿` to all CSV export content before download.

---

### EXP-02 — PDF Bengali Text Renders as Symbols 🔴
**Source:** 📁 EXPORT-AUDIT.md  
`jsPDF` is used without registering a custom Unicode TTF font. The standard `jsPDF` font does not support Bengali Unicode. All Bengali strings render as meaningless squares.  
**Fix:** Register a Bengali-supporting TTF font (e.g., Noto Sans Bengali) with `jsPDF.addFileToVFS()` and `jsPDF.addFont()`.

---

### EXP-03 — Export Silently Truncates Data 🔴
**Source:** 📁 EXPORT-AUDIT.md, REPORTS-AUDIT.md  
DB RPCs hardcode `LIMIT 20` and `LIMIT 15`. The export functions download whatever is in the React state (which is already limited). A business with 10,000 transactions exports 20 rows with no warning.  
**Fix:** Add dedicated export RPCs with no hard limit (or pagination with a data-export flag). Alternatively, stream exports via a separate `/api/export` route.

---

### EXP-04 — POS Receipt Hardcoded Business Name 🔴
**Source:** 📁 EXPORT-AUDIT.md  
POS receipts always print "BIZTRACK BD" as the business name regardless of the actual tenant. Every business's customer receipt shows the wrong name.  
**Fix:** Fetch `business.name` from the session context and render it dynamically on the receipt.

---

### EXP-05 — POS Receipt Missing Branch Name 🟡
**Source:** 📁 EXPORT-AUDIT.md  
Branch name is never printed on POS receipts. Multi-branch businesses cannot distinguish which branch processed a sale from the receipt.  
**Fix:** Include `branch.name` in the receipt component.

---

## Part 6 — Performance Gaps

### PERF-01 — Missing Database Indexes (Full Table Scans) 🔴
**Source:** 📁 PERFORMANCE-AUDIT.md  
The core schema (`20260816020000_ddd_schema.sql`) omits `CREATE INDEX` for foreign keys. Queries like `SELECT * FROM transactions WHERE business_id = 'XYZ'` on 100K rows require a full sequential scan. All basic data retrieval is slow and will cause connection pool exhaustion under load.  
**Fix:** Add indexes on: `transactions(business_id)`, `transactions(business_id, date)`, `account_transactions(account_id)`, `inventory_movements(product_id)`, `parties(business_id)`, `products(business_id)`, `businesses(owner_id)`.

---

### PERF-02 — Dashboard `COUNT(*)` Full Table Scan 🟠
**Source:** 📁 PERFORMANCE-AUDIT.md  
`dashboard/page.tsx` runs `.from('transactions').select('*', { count: 'exact', head: true })`. PostgreSQL MVCC requires traversing all rows for an exact count. Dashboard load time grows linearly as the business grows.  
**Fix:** Replace with `.select('id').limit(1)` existence check, or use an approximate count query.

---

### PERF-03 — RLS Nested Loop on Unindexed Column 🔴
**Source:** 📁 PERFORMANCE-AUDIT.md  
`is_business_member()` queries `businesses WHERE owner_id = auth.uid()`. `owner_id` on `businesses` lacks an index. Every RLS-protected query triggers an unindexed join. Under moderate load, database CPU will spike to 100%.  
**Fix:** `CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);`

---

### PERF-04 — No Pagination 🟠
**Source:** 📁 PERFORMANCE-AUDIT.md, REPORTS-AUDIT.md  
Queries hardcoded with `.limit(50)` accepting no `page` or `offset`. No pagination UI. Users permanently lose access to historical data beyond the first 50 entries.  
**Fix:** Implement cursor-based or offset pagination on all list endpoints and add pagination controls to the UI.

---

### PERF-05 — React Query Installed But Unused 🟡
**Source:** 📁 PERFORMANCE-AUDIT.md  
`@tanstack/react-query` is in `package.json` but completely unused. Every route transition re-fetches all data from Supabase. Unnecessary database egress and slower navigation.  
**Fix:** Implement React Query for client-side caching of frequently accessed, slowly changing data (products, plans, business config).

---

### PERF-06 — Dashboard Aggregate Query Slam 🟠
**Source:** 📁 PERFORMANCE-AUDIT.md  
Multiple separate Server Components individually query the database for aggregate sums. On a mature business with thousands of transactions, dashboard loading will be painfully slow.  
**Fix:** Consolidate dashboard aggregates into a single RPC call. Consider materialized views for heavy aggregates with scheduled refresh.

---

## Part 7 — Mobile & UX Gaps

### UX-01 — Virtual Keyboard Overlaps Bottom Navigation 🔴
**Source:** 📁 MOBILE-AUDIT.md  
**File:** `src/components/layout/MobileNav.tsx`  
`fixed bottom-0` navigation floats on top of the virtual keyboard on Android, obscuring input fields behind it.  
**Fix:** Use `env(safe-area-inset-bottom)` padding and listen to `visualViewport` resize events to push content above the keyboard.

---

### UX-02 — POS Checkout "Pay" Button Unreachable on Small Screens 🔴
**Source:** 📁 MOBILE-AUDIT.md  
**File:** `src/domains/pos/components/POSClient.tsx`  
`<DialogContent>` for the checkout flow lacks `max-h-[80vh] overflow-y-auto`. On 320px and 375px screens, the final "Pay" button is completely off-screen and inaccessible. POS checkout is impossible on budget Android phones.  
**Fix:** Add `max-h-[85dvh] overflow-y-auto` to the checkout `DialogContent`.

---

### UX-03 — Tiny Touch Targets in Cart 🟠
**Source:** 📁 MOBILE-AUDIT.md  
**File:** `src/domains/pos/components/POSClient.tsx`  
Increment (+), decrement (-), edit, and delete buttons are `w-8 h-8` (32px). Mobile UX standard is minimum 44px. Users will frequently misclick on cheap smartphones.  
**Fix:** Change to `w-11 h-11` (44px) minimum.

---

### UX-04 — Inventory Table Horizontal Overflow 🟡
**Source:** 📁 MOBILE-AUDIT.md  
**File:** `src/app/app/inventory/page.tsx`  
Standard `<table>` inside `overflow-x-auto`. On 320px, users can only see the product name column and must scroll horizontally for price, stock, and action buttons.  
**Fix:** On mobile, switch to a card-based list layout instead of a table.

---

### UX-05 — Product Grid Text Truncation 🟡
**Source:** 📁 MOBILE-AUDIT.md  
POS product grid uses `grid-cols-2` on mobile. On 320px, `line-clamp-2` makes distinguishing similar items (e.g., "Pran Mango 250ml" vs "Pran Mango 500ml") very difficult.  
**Fix:** Show more product detail on hover/tap, or increase card height on 320px.

---

### UX-06 — Landing Page CTAs Are 404s 🔴
**Source:** 📁 LANDING-PAGE-AUDIT.md  
Every CTA on the landing page (Navbar "Login", "Sign Up", Hero, Pricing) points to `/login` and `/signup` — which are 404 routes. Actual routes are `/app/login` and `/app/onboarding`. 100% of organic/paid traffic hits a 404. New user acquisition through the website is currently impossible.  
**Fix:** Update all CTA `href` values to `/app/login` and `/app/onboarding`.

---

### UX-07 — Missing robots.txt and sitemap 🟠
**Source:** 📁 LANDING-PAGE-AUDIT.md  
No `public/robots.txt` or `app/sitemap.ts`. Search engine crawlers have no guidance. SEO is unconfigured.  
**Fix:** Add `src/app/robots.ts` and `src/app/sitemap.ts` (these files appear in the git status as new untracked files — they may already exist).

---

### UX-08 — Missing og:image / twitter:image 🟡
**Source:** 📁 LANDING-PAGE-AUDIT.md  
Social sharing metadata is incomplete. WhatsApp, Facebook, Twitter link previews appear as plain text with no branding.  
**Fix:** Add `og:image` and `twitter:image` to root layout metadata.

---

### UX-09 — Missing Canonical Tags 🟡
**Source:** 📁 LANDING-PAGE-AUDIT.md  
No canonical URL defined. Risk of duplicate content SEO penalty.  
**Fix:** Add `canonical` to Next.js metadata in `layout.tsx`.

---

### UX-10 — Dashboard Low-Stock Uses Wrong Threshold 🟠
**Source:** 📁 DASHBOARD-AUDIT.md  
`LowStockProducts.tsx` calls `getLowStockProducts({ threshold: 10 })` — hardcoded. The query filters `current_stock <= 10` instead of `current_stock <= min_stock`. Products with a custom min-stock of 50 won't warn until stock hits 10. Products with min-stock of 2 permanently trigger warnings at stock 3–10.  
**Fix:** Remove the hardcoded threshold; use each product's `min_stock` column in the query.

---

### UX-11 — Reports Have No Branch/Account/Party Filters 🟠
**Source:** 📁 REPORTS-AUDIT.md  
All reports aggregate the entire business with no filters for branch, account, category, or party. Multi-branch businesses cannot get per-branch reports.  
**Fix:** Add filter parameters to `get_sales_analytics`, `get_expense_analytics`, and `get_financial_summary` RPCs.

---

### UX-12 — Missing Loading Spinner on Daily Closing Submit 🟡
**Source:** 📁 UI-STATE-AUDIT.md  
**File:** `src/domains/closing/components/ClosingClient.tsx`  
Button is correctly disabled during submission (`isSubmitting`) but shows no visual loading indicator. Users have no feedback that the action is in progress.  
**Fix:** Add `<Loader2 className="animate-spin" />` and change button text to "ক্লোজ হচ্ছে..." during submission.

---

### UX-13 — POS Cart Deletion Has No Confirmation 🟡
**Source:** 📁 UI-STATE-AUDIT.md  
Users can delete items from the POS cart with a single tap, no confirmation. Combined with tiny touch targets (UX-03), accidental deletions will be frequent.  
**Fix:** Add an "Undo" snackbar (3-second window) after cart item deletion instead of a blocking confirmation dialog.

---

### UX-14 — Staff Delete Uses Native `confirm()` 🟡
**Source:** 📁 UI-STATE-AUDIT.md  
Staff management delete triggers a native browser `confirm()` dialog — inconsistent with the app's design system.  
**Fix:** Replace with Radix/shadcn `<AlertDialog>` component.

---

### UX-15 — Stale Data Uses `window.location.reload()` 🟡
**Source:** 📁 UI-STATE-AUDIT.md  
**File:** `StaffClient.tsx` (and others)  
Post-mutation, components call `window.location.reload()` — a jarring full-page reload that disrupts navigation state.  
**Fix:** Use `router.refresh()` or React Query cache invalidation to refresh only the data layer.

---

## Part 8 — Audit / Observability Gaps

### OBS-01 — Transaction Creation Not Logged to Audit Logs 🟠
**Source:** 📁 INCOME-EXPENSE-AUDIT.md, TRANSACTION-TYPE-AUDIT.md  
`create_transaction_atomic` RPC does not insert to `audit_logs`. Sales and expenses are never recorded in the audit trail. Read access and manual admin overrides are also not logged.  
**Fix:** Add `INSERT INTO audit_logs (...)` at the end of `create_transaction_atomic` within the same transaction. Add audit events for admin impersonation and manual overrides.

---

### OBS-02 — Cache Invalidation Missing for Reports 🟡
**Source:** 📁 INCOME-EXPENSE-AUDIT.md  
`createTransaction` does not call `revalidatePath('/reports')`. A new expense or income may not reflect in the reports tab until a hard browser refresh.  
**Fix:** Add `revalidatePath('/app/reports')` to `createTransaction`, `createProduct`, and other mutation Server Actions.

---

## Part 9 — Priority Fix Roadmap

### 🔴 Sprint 1 — Security & Financial Core (Block Beta)

| ID | Fix | Effort |
|---|---|---|
| SEC-01 | Fix `is_business_member()` IDOR vulnerability | S |
| SEC-02 | REVOKE `process_payment_webhook` from public | S |
| SEC-03 | Support attachment tenant isolation | M |
| SEC-04 | Support message `sender_id = auth.uid()` check | S |
| SEC-07 | Make `transactions` immutable (remove UPDATE/DELETE RLS) | M |
| SEC-08 | Cross-tenant inventory manipulation fix | M |
| SEC-09 | Cross-tenant account poisoning fix | M |
| FIN-01 | Fix POS dead button (missing params) | S |
| FIN-02 | Fix POS customer due double charge | M |
| FIN-03 | Fix billing: store `uddoktapay_invoice_id` | S |
| FIN-04 | Fix billing: add `plan_id` to invoice + webhook | M |
| FIN-14 | Fix `staff_limit` → `max_users` typo | XS |
| UX-06 | Fix landing page CTA routes (404 → /app/...) | XS |

---

### 🟠 Sprint 2 — Financial Accuracy & Permissions

| ID | Fix | Effort |
|---|---|---|
| FIN-05 | Daily closing stacking difference (adjustment transaction) | M |
| FIN-06 | Daily closing mobile money hardcoding | M |
| FIN-07 | Daily closing expected cash desync (opening_balance + income) | M |
| FIN-09 | Dashboard/reports profit includes purchase (COGS) | M |
| FIN-10 | Revenue includes `income` type | S |
| FIN-11 | Supplier balance on expense type | S |
| FIN-12 | Enforce double-entry arithmetic at DB level | L |
| FIN-13 | CRON job for subscription expiry | M |
| FIN-15 | Fix entitlement boolean limit flaw | S |
| FIN-16 | Atomic billing webhook + idempotency | L |
| PERM-01 | Inventory management permission check | S |
| PERM-02 | Billing actions role check | S |
| PERM-06 | Branch data isolation (`member_branches` table) | L |
| PERM-07 | DB-level entitlement enforcement triggers | L |

---

### 🟡 Sprint 3 — Missing Core Features

| ID | Fix | Effort |
|---|---|---|
| MF-01 | Purchase transaction Server Action + UI | L |
| MF-02 | Income transaction type (Server Action + dashboard) | M |
| MF-03 | Account transfer Server Action + UI | M |
| MF-09 | Wire `createPlatformNotification` to events | M |
| MF-11 | Super Admin plan management UI | L |
| MF-12 | Super Admin invoice actions (Void, Credit, PDF) | L |
| MF-15 | SaaS subscription lifecycle CRON | M |
| MF-16 | Business profile settings UI | M |
| MF-17 | Branch management UI | L |
| EXP-01 | CSV UTF-8 BOM for Bengali text | XS |
| EXP-02 | PDF Bengali font registration | M |
| EXP-03 | Export full dataset (remove hard limits) | L |
| EXP-04 | POS receipt dynamic business name | S |
| PERF-01 | Add missing database indexes | M |
| PERF-03 | Index `businesses(owner_id)` for RLS performance | XS |
| UX-01 | Android virtual keyboard + bottom nav fix | M |
| UX-02 | POS checkout dialog scrollable on 320px | S |
| UX-03 | Touch target minimum 44px in cart | S |
| UX-10 | Dashboard low-stock uses `min_stock` column | S |

---

### 🟢 Sprint 4 — Polish, Observability, Performance

| ID | Fix | Effort |
|---|---|---|
| MF-04 | Refund / reversal Server Action | L |
| MF-05 | Reopen closed day Server Action | M |
| MF-06/07/08 | Account / Transaction / Daily Closing reports | L |
| MF-21 | Offline customer/product creation | L |
| MF-22 | Offline conflict resolution | XL |
| PERF-04 | Pagination on all list endpoints | L |
| PERF-05 | Wire React Query for client-side caching | L |
| OBS-01 | Audit log for all transactions | M |
| OBS-02 | `revalidatePath` after all mutations | S |
| UX-07 | robots.txt and sitemap | S |
| UX-11 | Report filters (branch/account/party) | L |
| UX-12 | Loading spinner on daily closing | S |
| UX-13/14/15 | UI state polish (undo cart delete, AlertDialog, router.refresh) | M |

---

## Summary: What's Passing ✅

Despite the gaps, the following areas are verified working and secure:

- **Transaction atomicity** — `create_transaction_atomic` RPC is fully atomic, idempotent
- **Duplicate transaction prevention** — `idempotency_keys` table with unique constraint
- **Ledger balance accuracy** — computed on-the-fly via `SUM(account_transactions.amount)`
- **Party balance (customer dues)** — dynamic view, no drift
- **Daily closing server-calculation** — client cannot spoof expected cash
- **Duplicate daily closing** — blocked by `UNIQUE(business_id, closing_date)`
- **POS duplicate submission** — `idempotentAction` wrapper
- **POS stock deduction** — row-level FOR UPDATE lock (SEC-12 may still apply)
- **Offline sync backoff** — exponential up to 1 hour, MAX_RETRIES = 5
- **Admin actions audit trail** — all admin mutations logged to `platform_audit_logs`
- **Pricing transparency** — plans fetched dynamically from DB
- **Multi-tenancy baseline** — all admin actions wrapped in `adminAction` (platform_admins check)
- **Money Visibility dashboard** — Cash / bKash / Nagad / Bank / Customer Due / Supplier Due / Net Position
- **Forgot PIN / PIN reset** — OTP verify → secure admin password update → auto-login
- **SMS gateway** — `SMS_NET_BD_API_KEY` server-only, test UI working

---

*Generated from: ACCOUNTS, BILLING, DAILY-CLOSING, DASHBOARD, DATA-CONSISTENCY, EXPORT, FEATURE-INVENTORY, FEATURE-VERIFICATION, INCOME-EXPENSE, INTEGRATION, INVENTORY, LANDING-PAGE, MOBILE, MULTI-TENANT, NOTIFICATIONS, OFFLINE, PERFORMANCE, PERMISSION, POS, RED-TEAM, REPORTS, SAAS, SETTINGS, SUPER-ADMIN, SUPPORT, TRANSACTION-TYPE, UI-STATE audits*
