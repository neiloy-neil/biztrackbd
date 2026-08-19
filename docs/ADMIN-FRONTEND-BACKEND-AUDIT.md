# Admin Frontend/Backend Alignment Audit

This document tracks the alignment between frontend UI forms, Server Actions, Zod validation schemas, and database RPCs/RLS across the 16 Admin functional areas.

## Phase 1 Findings & Issues

### 1. Missing Audit Logs on Critical Mutations (P1 - Major)
**Issue**: The Admin plane requires strict compliance tracking. Several server actions perform global mutations without emitting an audit log using the `auditLog()` utility. This leaves blind spots in the Platform Audit logs.
**Affected Domains**:
- `feature-flags.ts`: Mutations like `createFeatureFlag`, `toggleGlobalFeatureFlag`, `setFlagPlanEntitlement`, and `addFlagOverride` completely lack audit logs.
- `notifications.ts`: Actions like `deleteNotification` and `updateNotificationPreferences` lack audit logging.
- `promotions.ts`: `createCoupon`, `toggleCouponActive`, `extendTrial`, and `grantPromotionalCredit` modify billing states without audit logs.
**Fix Required**: Inject `auditLog(...)` into all these mutations to record the action, the admin user's ID, and the payload/changes.

### 2. Dead Forms & Non-Prevented Submissions (P2 - Minor)
**Issue**: Several page components contain raw `<form>` tags meant for search inputs, but they lack `onSubmit` handlers. Hitting 'Enter' inside these inputs causes a full browser page reload instead of utilizing Next.js client-side routing or Server Actions.
**Affected Pages**:
- `/admin/businesses/page.tsx`
- `/admin/feature-flags/page.tsx`
- `/admin/users/page.tsx`
**Fix Required**: Add `onSubmit={(e) => e.preventDefault()}` to these forms.

### 3. Dead UI Components & Fake Buttons (P1 - Major)
**Issue**: Some UI elements represent administrative capabilities but have no actual onClick handlers or backend wiring.
**Examples**:
- **Businesses**: The "Change Plan" button in `businesses/[id]/actions-menu.tsx` is completely dead. There is no modal, form, or handler wired to the `updateBusinessPlanAction`.
**Fix Required**: Hide, disable, or implement missing UI interactions where the backend action already exists but the UI is dead. (e.g., Wire up a "Change Plan" modal or prompt).

## Remediation Plan (Next Steps)

1. **Audit Log Sweeps**: Refactor `feature-flags.ts`, `notifications.ts`, and `promotions.ts` to include standard audit logging.
2. **Fix Dead Forms**: Add `e.preventDefault()` to search/filter forms.
3. **Patch Dead Buttons**: Resolve the fake "Change Plan" button in the Businesses Actions Menu by wiring it to a functional prompt or removing it if it's out of scope for the current UI.
