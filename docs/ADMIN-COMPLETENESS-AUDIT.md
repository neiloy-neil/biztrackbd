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
- **Status:** Aligned / Complete
- **UI completeness:** Table exists. Detail page exists. Actions added (Void, Refund, Mark Paid).
- **Backend action:** Added `voidInvoiceAction`, `refundInvoiceAction`, `markInvoicePaidAction` inside `invoice.actions.ts`.
- **Permissions:** `platform.invoices.view` wrapped around `page.tsx`. `platform.billing.manage` wrapped around mutations.
- **Missing:** None.

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
- **Status:** Aligned / Complete
- **UI completeness:** View logs. Filter. Export CSV.
- **Backend action:** Added CSV export endpoint (`/api/admin/export-audit-logs`).
- **Permissions:** Export checks `platform.audit.view`.
- **Missing:** None.

## 9. Settings (`/admin/settings`)
- **Status:** Aligned / Complete
- **UI completeness:** Form fields for General, Auth, Billing, Security, Communication, and System settings exist and function correctly.
- **Backend action:** `updatePlatformSetting()` in `settings.actions.ts`.
- **Permissions:** Explicit `platform.settings.manage` wrapper added to `page.tsx` and actions.
- **Missing:** None.

## 10. Admin Management (Super Admin) (`/admin/team`)
- **Status:** Aligned / Complete
- **UI completeness:** Dedicated table to view platform admins, invite form, and change role/revoke modal.
- **Backend action:** `invitePlatformAdminAction`, `updatePlatformAdminRoleAction`, `removePlatformAdminAction`.
- **Permissions:** Explicit `platform.admins.manage` wrapper added to the page and all mutations.
- **Missing:** None.

---

## High Priority Fixes (P0/P1)

1. **[P0]** Refactor `src/domains/admin/actions.ts` to use `adminAction(permission, ...)` from `auth-wrappers.ts` instead of `safe-action.ts`.
2. **[P0]** Replace all inline `createClient()` calls inside `app/admin/(protected)/**/page.tsx` with `createAdminAuthClient()`.
3. **[P1]** ~~Implement Admin Management UI so Super Admins can actually invite billing/support staff.~~ (Completed)
4. **[P1]** ~~Implement the Settings page.~~ (Completed)
5. **[P2]** ~~Add Invoice mutation actions (Refund, Void).~~ (Completed)
6. **[P2]** ~~Wire up Audit Logs CSV Export.~~ (Completed)
