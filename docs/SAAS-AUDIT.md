# SaaS Subscription System Audit

## Executive Summary
This document outlines the findings of the SaaS subscription and entitlement system audit. The system currently functions as a facade. While the database schema theoretically supports complex tiering, the enforcement layers are fundamentally broken. Users can bypass nearly all limitations, subscriptions never truly expire, and certain legitimate operations are permanently blocked due to hardcoded typos.

---

## 1. Plan Enforcement & Limit Bypasses (CRITICAL BUGS)

The system defines limits via `public.plan_features` (e.g., `max_users`, `max_products`, `transactions_per_month`). However, enforcement is missing or broken across all layers:

### A. Database Enforcement Failures
- **The Trigger Gap:** The database utilizes a function `check_usage_limit` to enforce limits. However, this function is *only* called via an `AFTER INSERT` trigger on the `transactions` table (`trg_track_transaction_usage`).
- **Bypass:** There are absolutely **NO database triggers** attached to the `products`, `business_members`, or `branches` tables. As a result, a user on the Free plan can create 100,000 products or users via API or direct DB interaction without ever triggering a limit exception.

### B. Server Action Authorization Failures
- **Products:** The `createProduct` Server Action completely omits any calls to the entitlement engine. It does not check `get_business_entitlements` or `canUseFeature`.
- **API Access:** The `api_access` feature flag is only checked visually in the UI (`hasFeature('api_access') ? <Check> : <X>`). The actual API routes do not verify this entitlement, meaning Free tier users have full API access.

### C. The `staff_limit` Typo (Permanent Denial of Service)
- When a business owner attempts to add a new staff member, the server action `src/domains/settings/actions.ts` calls `canUseFeature(ctx.businessId, 'staff_limit')`.
- **The Bug:** The database provisions the feature key as `max_users`, not `staff_limit`. Because `staff_limit` is `undefined` in the entitlements payload, the engine defaults to `false`. **Result:** Nobody, on any plan, can ever add staff members through the UI.

### D. The Boolean Limit Flaw
- The Free plan sets `max_users = 1` and `max_branches = 1`. 
- The TypeScript entitlement engine (`canUseFeature`) contains a logic flaw where it treats `limit === 1` as a boolean "enabled" flag and immediately returns `true` before checking current usage.
- **Result:** Even if the `staff_limit` typo is fixed, the engine will allow infinite users on the Free plan because it skips the metered check entirely.

---

## 2. Subscription Lifecycle Failures

### A. Infinite Expiration Bug
- When fetching a business's active entitlements, the system queries: `WHERE s.status IN ('active', 'trialing')`.
- **The Bug:** It completely fails to check `AND current_period_end > now()`.
- **Result:** If a user cancels their subscription or their payment fails, the webhook updates `cancel_at_period_end = true`. However, because there is no CRON job to transition expired subscriptions to `past_due` or `suspended`, the `status` remains `'active'` in the database forever. The user retains premium features indefinitely.

### B. Upgrades/Downgrades
- The schema contains `scheduled_plan_id` to handle deferred downgrades at the end of a billing cycle. However, because the system never processes period-end events (due to the lack of a CRON worker), scheduled downgrades are never applied.

---

## 3. Feature Matrix Status

| Feature Limit | UI Enforcement | Server Action Check | Database Trigger | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Transactions** | None | 🟢 Yes | 🟢 Yes | Working |
| **Products** | None | 🔴 No | 🔴 No | **Bypassable** |
| **Users** | None | 🔴 Broken (Typo) | 🔴 No | **Broken (Always Denies)** |
| **Branches**| None | 🔴 No | 🔴 No | **Bypassable** |
| **API Access** | Visual Only | 🔴 No | 🔴 No | **Bypassable** |

## Conclusion
The SaaS module requires a complete overhaul of the Entitlement Engine. At a minimum, triggers must be added to all metered tables, the expiration query must respect `current_period_end`, and the `staff_limit`/boolean evaluation bugs must be fixed before billing any customers.
