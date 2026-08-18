# Platform Admin Completeness Audit

This document audits the current state of every module in the Super Admin routing plane against backend capabilities, specifically evaluating completeness, RBAC integration, and missing features.

## General Security & Routing Findings
- **Missing Granular RBAC Wrappers:** All Server Actions in `src/domains/admin/actions.ts` are using the legacy `adminAction` wrapper from `src/lib/actions/safe-action.ts`, which only verifies membership in `platform_admins`. It does **not** take or verify specific permissions (e.g., `platform.businesses.manage`). The new `adminAction` wrapper created in `src/lib/auth-wrappers.ts` must replace these.
- **Client Instance Leakage:** Several Admin pages (like Invoices and Audit Logs) still instantiate `createClient()` (the business client) inline in Server Components instead of `createAdminAuthClient()`, meaning they are vulnerable to relying on the business `sb-[ref]-auth-token` rather than the `sb-admin-auth-token`.

---

## 1. Dashboard (`/admin/dashboard`)
- **Status:** Partially Aligned
- **UI completeness:** Shows metrics grid and charts.
- **Backend action:** `getPlatformMetrics()`, `getPlatformGrowth()`
- **Permissions:** Missing explicit `platform.dashboard.view` check on server actions.
- **Audit event:** Emits `viewed_platform_metrics` correctly.
- **Missing:** Granular role wrapper.

## 2. Businesses (`/admin/businesses`)
- **Status:** Mostly Aligned
- **UI completeness:** List, View Detail, Suspend, Reactivate, Soft Delete, Update Plan are present.
- **Backend action:** All mapped to RPCs in `actions.ts`.
- **Permissions:** Missing explicit `platform.businesses.view` and `platform.businesses.manage` wrappers.
- **Audit event:** All mutations emit a platform audit event and create notifications.
- **Missing:** Granular role wrapper.

## 3. Users (`/admin/users`)
- **Status:** Mostly Aligned
- **UI completeness:** List, View Detail, Suspend, Reactivate, Force Logout.
- **Backend action:** Mapped to RPCs.
- **Permissions:** Missing `platform.users.manage` wrapper.
- **Audit event:** Exists.
- **Missing:** Role wrapper.

## 4. Billing / Plans (`/admin/billing`)
- **Status:** Partially Aligned
- **UI completeness:** View plans, edit plan details, edit feature limits.
- **Permissions:** Missing `platform.plans.manage` wrapper.
- **Missing:** Cannot currently *create* a new plan from the UI (only edit existing).

## 5. Invoices (`/admin/invoices`)
- **Status:** Backend Dead / Broken
- **UI completeness:** Basic list table.
- **Backend action:** Inline `supabase.from('invoices')` query in `page.tsx`. Missing pagination. No server actions.
- **Permissions:** Inline `platform_admins` manual check, completely ignoring RBAC matrix and `has_platform_permission`.
- **Missing:** "Refund Invoice", "Void Invoice", "Mark as Paid", "Download PDF" actions are entirely missing.

## 6. Promotions / Coupons (`/admin/promotions`)
- **Status:** Partially Aligned
- **UI completeness:** List and toggle active status.
- **Backend action:** `getCoupons()`, `CreateCouponForm` exists.
- **Permissions:** Lacks explicit `platform.coupons.manage`.
- **Missing:** No ability to delete/archive a coupon.

## 7. Support (`/admin/support`)
- **Status:** Partially Aligned
- **UI completeness:** Unknown full extent, but `actions.ts` in `src/domains/support/actions.ts` was previously updated.
- **Permissions:** Verified it uses `has_platform_permission('platform.support.manage')` via inline RPC calls, but should be refactored to use the new `adminAction` wrapper.

## 8. Audit Logs (`/admin/audit-logs`)
- **Status:** Frontend Mock / Broken Server Side
- **UI completeness:** Table exists.
- **Backend action:** Inline query in `page.tsx`.
- **Permissions:** Manual `platform_admins` lookup instead of `platform.audit.view`.
- **Missing:** 
  - CSV Export button is a dead placeholder.
  - Action filtering relies on a dynamic `SELECT action` which is slow on large datasets.

## 9. Settings (`/admin/settings`)
- **Status:** DEAD UI / Missing Implementation
- **UI completeness:** Contains only the `SmsGatewayTester` component.
- **Missing:** 
  - General Settings (Platform name, Logo, etc.)
  - Authentication limits
  - Billing configurations (grace periods, default currency)
  - Security configurations
  - System Health metrics
- **Permissions:** No wrapper.

## 10. Admin Management (Super Admin)
- **Status:** MISSING
- **UI completeness:** There is no UI to view, create, or assign roles to Platform Admins.
- **Backend action:** Missing.
- **Permissions:** `platform.admins.manage` is defined in the database but completely unused by any frontend component.

---

## High Priority Fixes (P0/P1)

1. **[P0]** Refactor `src/domains/admin/actions.ts` to use `adminAction(permission, ...)` from `auth-wrappers.ts` instead of `safe-action.ts`.
2. **[P0]** Replace all inline `createClient()` calls inside `app/admin/(protected)/**/page.tsx` with `createAdminAuthClient()`.
3. **[P1]** Implement Admin Management UI so Super Admins can actually invite billing/support staff.
4. **[P1]** Implement the Settings page.
5. **[P2]** Add Invoice mutation actions (Refund, Void).
6. **[P2]** Wire up Audit Logs CSV Export.
