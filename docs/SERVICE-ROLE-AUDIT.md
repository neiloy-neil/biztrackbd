# Service Role Audit Report

This document classifies every usage of the Supabase Service Role across the BizTrack BD repository to verify strict adherence to the Canonical Architecture. 

## Classification Rules
1. **Publicly Callable**: Unauthenticated server actions (e.g., Auth/Signup). Must have strict rate limits and input sanitization.
2. **Authenticated Business Operation**: Operations performed by Business users that require traversing tenant boundaries (e.g., checkout/billing).
3. **Admin Operation**: Actions performed by Platform Admins on the `adminAction` plane.
4. **Internal System Operation**: Server-only helper functions/classes (e.g., BillingService).
5. **Cron**: Automated tasks executed by Vercel cron endpoints.
6. **Webhook**: Third-party callbacks (e.g., payment gateways).

---

## 1. Admin Operations
*Admin routes must use the canonical `adminAction` wrapper to verify `platform_admins` role before granting Service Role access.*

### ✅ `src/domains/admin/*.actions.ts` (All Admin Actions)
- **Status:** PASS
- **Authentication:** Validates Admin session via `createAdminAuthClient`.
- **Authorization:** Standardized via `adminAction` + `PLATFORM_PERMISSIONS`.
- **Tenant Context:** Secure.

### ❌ `src/domains/support/actions.ts`
- **Status:** **P0 VIOLATION**
- **Issue:** Exports `updateTicketStatus` and `assignTicket` as plain Server Actions. Uses `getAdminSupabase()` which checks the **Business Auth Client** instead of the **Admin Auth Client**, completely bypassing the standardized `adminAction` authorization flow.
- **Action Required:** Refactor to use `adminAction(PLATFORM_PERMISSIONS.SUPPORT_MANAGE)`.

---

## 2. Publicly Callable Operations
*Operations that handle unauthenticated user interactions, primarily identity creation and verification.*

### ✅ `src/domains/auth/actions.ts`
- **Status:** PASS
- **Usages:** 
  - `checkUserExists()`
  - `sendOtp()`
  - `verifyOtpAndCreateUser()`
  - `resetPin()`
- **Authentication:** None (Publicly exposed by design).
- **Security Validation:** Implements strict rate-limiting (`rateLimit`). Input sanitization (e.g. `normalizePhone`). 
- **Notes:** Service role is required here to write to `phone_otps` and provision users via `admin.createUser`.

---

## 3. Internal System Operations
*Classes and services invoked by authenticated controllers.*

### ✅ `src/domains/billing/checkout.ts` & `src/domains/billing/service.ts`
- **Status:** PASS
- **Usage:** Orchestrating complex database mutations that span tenant boundaries (e.g., fetching cross-tenant plans, creating skeleton businesses for new users).
- **Security:** Not exposed directly as Server Actions. Called securely by Webhooks or Authenticated API routes. 

---

## 4. Webhooks
*Endpoints invoked by 3rd party providers without standard Supabase auth.*

### ✅ `src/app/api/webhooks/uddoktapay/route.ts`
- **Status:** PASS
- **Authentication:** Verifies HTTP Header `RT-UDDOKTAPAY-API-KEY`.
- **Tenant Context:** Explicitly maps payment payload to internal metadata.
- **Action:** Delegates to `BillingService`.

---

## 5. Crons
*Automated endpoints triggered by Vercel.*

### ✅ `src/app/api/cron/billing/route.ts`
### ✅ `src/app/api/cron/daily-checks/route.ts`
### ✅ `src/app/api/cron/renewals/route.ts`
### ✅ `src/app/api/cron/smart-alerts/dues/route.ts`
### ✅ `src/app/api/cron/smart-alerts/subscriptions/route.ts`
- **Status:** PASS
- **Security:** Vercel automatically secures cron endpoints using the `CRON_SECRET` environment variable (built-in Vercel security feature). Requires service-role to query all tenants.

---

## Audit Conclusion & Next Steps
Overall, the service-role usage is disciplined and compartmentalized correctly into billing, cron, and auth systems. 

**However, the Support domain (`src/domains/support/actions.ts`) contains a critical P0 leak** that relies on the Business plane authentication and manual verification logic rather than the newly standardized canonical Admin authorization flow. This must be refactored immediately.
