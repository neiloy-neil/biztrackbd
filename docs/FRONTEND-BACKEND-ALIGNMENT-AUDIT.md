# BizTrack BD Frontend ↔ Backend Alignment Audit

## Executive Summary
This document provides a complete, non-destructive audit of the BizTrack BD repository, tracing every major feature from Frontend UI to Database/RLS to identify misalignment, dead code, missing permissions, and broken data contracts.

**Legend:**
- 🟢 **FULLY ALIGNED**: Complete top-to-bottom implementation with no missing data or broken contracts.
- 🟡 **PARTIALLY ALIGNED**: Exists on both ends but suffers from missing fields, mismatched types, or stale cache.
- 🟠 **FRONTEND ONLY**: UI exists but relies on mock data or un-implemented server actions.
- 🔵 **BACKEND ONLY**: Server actions/SQL exists but no UI consumes it.
- 🔴 **BROKEN**: Fatal mismatch (e.g., incorrect routing, fatal SQL errors, missing tables).
- 💀 **DEAD UI / DEAD BACKEND**: Code that is no longer accessible or deprecated.
- ⚠️ **SECURITY RISK**: Missing RLS, bypassed permissions, or exposed internal data.

---

## 1. Core Identity & Multi-Tenancy

### Authentication
**Status:** 🟢 FULLY ALIGNED
- **UI:** `/app/login`, `/app/register`
- **Backend:** `supabase.auth`
- **Notes:** Full alignment. Session cookies are correctly managed. 

### Business Onboarding
**Status:** 🟢 FULLY ALIGNED
- **UI:** `/app/onboarding`
- **Backend:** `businesses`, `business_members` (owner role assigned)
- **Notes:** Correctly writes to DB. Recent checkout fixes ensure new businesses are properly associated with pending subscriptions.

### Staff & Branches
**Status:** 🔴 BROKEN & ⚠️ SECURITY RISK
- **UI:** `/app/settings/staff`, `BranchClient.tsx`
- **Backend:** `branches`, `user_roles`
- **Gaps:** 
  - **Security Risk:** RLS policies on `branches` do not consistently enforce `branch_id` scoping for standard staff members. A staff member assigned to Branch A can currently read inventory for Branch B via API.
  - **Broken:** The "Add Staff" form sends role strings that do not match the database `ENUM` for user roles, resulting in a 500 error when saving.

---

## 2. Operations & Financials

### Dashboard
**Status:** 🟡 PARTIALLY ALIGNED
- **UI:** `DashboardHealthScore.tsx`, `InsightsDashboard.tsx`
- **Backend:** `getDashboardMetrics` RPC
- **Gaps:** The frontend UI is requesting `revenue_growth_percentage`, but the returned RPC payload is mapping it as `growth_rate`. The UI renders `undefined` (shows as 0%).

### Transactions (Income/Expense)
**Status:** 🟢 FULLY ALIGNED
- **UI:** `TransactionList.tsx`, `VoidTransactionButton.tsx`
- **Backend:** `transactions` table, `void_transaction` RPC
- **Notes:** Both UI and server actions enforce atomicity and correct `business_id` scoping.

### Parties (Customers & Suppliers)
**Status:** 🟡 PARTIALLY ALIGNED
- **UI:** `/app/parties`
- **Backend:** `parties` table
- **Gaps:** The `credit_limit` column exists in the database but is **not displayed or persisted** by the Frontend form. The UI has a "Category" dropdown that is **FRONTEND ONLY** (no corresponding column in the DB).

### Inventory
**Status:** 🟢 FULLY ALIGNED
- **UI:** `ProductList.tsx`
- **Backend:** `inventory_items`, `inventory_reversal_engine.sql`
- **Notes:** Stock movements and reversals are strictly aligned with DB constraints.

### POS (Point of Sale)
**Status:** 🟠 FRONTEND ONLY
- **UI:** `/app/pos`
- **Backend:** N/A (Missing dedicated cart-to-transaction RPC)
- **Gaps:** The POS interface shows a shopping cart, but the "Checkout" button maps to a dead action. The UI currently relies on mock data for the barcode scanner flow.

### Daily Closing
**Status:** 🟢 FULLY ALIGNED
- **UI:** `/app/closing`
- **Backend:** `daily_closings` table, validation logic
- **Notes:** Strict alignment.

---

## 3. Reporting & Analytics

### Reports
**Status:** 🟡 PARTIALLY ALIGNED
- **UI:** `/app/reports`
- **Backend:** `generate_report` RPC
- **Gaps:** 
  - **Stale Cache:** The frontend caches report results too aggressively. Changes in the current day's transactions aren't reflected until a hard refresh.
  - **Missing Invalidation:** `revalidatePath` is missing on transaction inserts.

### Money Visibility & Business Health
**Status:** 🟢 FULLY ALIGNED
- **UI:** `BusinessHealthScore.tsx`
- **Backend:** `business_health_score.sql`
- **Notes:** Perfectly aligned.

### Insights
**Status:** 🟢 FULLY ALIGNED
- **UI:** `/app/insights`
- **Backend:** `actionable_insights.sql`

---

## 4. Administration & Support

### Notifications
**Status:** 🔵 BACKEND ONLY
- **UI:** N/A
- **Backend:** `smart_alerts_schema.sql`, `smart_alerts_generation.sql`
- **Gaps:** The backend is fully generating alerts, but there is no `Notifications` dropdown or page in the frontend to consume them. 

### Support
**Status:** ⚠️ SECURITY RISK
- **UI:** `/app/support`
- **Backend:** `support_tickets`
- **Gaps:** 
  - **Security Risk:** Missing RLS on `support_tickets_replies`. Any authenticated user can read replies for tickets belonging to other businesses if they guess the ticket ID.

### Super Admin / Admin Settings
**Status:** 🔵 BACKEND ONLY
- **UI:** `/admin/*` exists but is mostly empty placeholders.
- **Backend:** Platform admin policies `is_platform_admin()` exist.
- **Gaps:** Admin APIs exist for impersonation and global analytics, but there are **actions without UI**.

### Admin Billing & Subscriptions
**Status:** 🟡 PARTIALLY ALIGNED
- **UI:** `/admin/billing`
- **Backend:** `subscriptions`, `invoices`
- **Gaps:** Admin frontend shows raw Stripe/UddoktaPay IDs but lacks action buttons to force-cancel or refund. The server actions for refunding exist but are not wired to the UI.

---

## 5. Billing & Subscriptions (SaaS)

### Checkout & Subscriptions
**Status:** 🟢 FULLY ALIGNED
- **UI:** `/app/checkout`, Pricing page
- **Backend:** `checkout_sessions.sql`, `subscription_renewals.sql`, `service.ts`
- **Notes:** Completely aligned. New user flows, coupon validation, and webhook idempotency strictly enforce server-authoritative data.

### Feature Flags
**Status:** 🔵 BACKEND ONLY
- **UI:** N/A
- **Backend:** `feature_flags` table
- **Gaps:** The database has a table for feature flags, but the frontend does not fetch or gate UI elements based on these flags.

## Summary of Actionable Gaps
1. Fix `user_roles` enum mismatch in the Staff onboarding form.
2. Implement strict `branch_id` RLS on `inventory` and `transactions`.
3. Fix RLS on `support_tickets_replies`.
4. Build the missing POS transaction RPC to connect the frontend cart to the database.
5. Add `revalidatePath` to transaction mutations to fix stale reporting caches.
6. Connect the `credit_limit` DB column to the Parties UI.
7. Build the Notifications UI to consume `smart_alerts`.
