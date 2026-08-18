# Public Checkout & SaaS Purchase Audit

This document audits the end-to-end public SaaS purchase journey, explicitly verifying if a brand-new user can purchase directly from the landing page without an `active_business_id`.

## 1. Current Implementation vs Required Target

**Currently Implemented Flow (For New Users):**
1. Visitor clicks "Select Plan" on Landing Page (`startCheckoutIntent` sets `checkout_intent` cookie).
2. Redirected to `/app/login` (Identity verification).
3. Post-login, user has no businesses, so `getRedirectPath` forces them to `/app/onboarding`.
4. User completes Business Onboarding.
5. `completeOnboarding` server action reads `checkout_intent`, provisions a business, sets `active_business_id`, and redirects to `/app/checkout`.
6. User pays at `/app/checkout`.

**Is it possible to checkout WITHOUT `active_business_id`?**
**NO.** The current `processCheckoutIntent` inside `src/domains/billing/actions/checkout.ts` explicitly blocks the transaction if the cookie is missing:
```typescript
const businessIdCookie = cookieStore.get('active_business_id')?.value
if (!intentCookie || !businessIdCookie) {
  return { success: false, error: 'Checkout session expired or invalid' }
}
```
Furthermore, it attempts to verify business membership (`select id from business_members eq business_id`) which will immediately fail.

**Conclusion:** The current architecture forces **Business Onboarding BEFORE Checkout**.

---

## 2. Gap Analysis Against Required Target

The required target flow is:
`Visitor -> Select Plan -> Login -> Checkout -> Payment -> Webhook -> Subscription -> Onboarding -> Dashboard`

To achieve this, the following changes are required:

### A. Auth Redirection
- **Current:** `verifyOtpAndCreateUser` and `getRedirectPath` redirect new users to `/app/onboarding`.
- **Required:** If a `checkout_intent` cookie exists, the post-login redirect must bypass `/app/onboarding` and go straight to `/app/checkout`.

### B. Checkout Session Creation
- **Current:** `processCheckoutIntent` demands `businessIdCookie`.
- **Required:** `processCheckoutIntent` must gracefully accept `businessIdCookie` as undefined. It must bypass the `business_members` membership check if `businessIdCookie` is absent.

### C. Skeleton Business Provisioning
- **Current:** `BillingService.startSessionPayment` already has logic to provision a skeleton business (`businesses.insert({ name: 'My Business' })`) if `session.business_id` is null! 
- **Required:** We must ensure `checkout_sessions.insert` allows `business_id` to be null. Currently, if `checkoutService.createSession` passes `businessId: undefined`, it relies on the DB accepting a null `business_id`. 

### D. Post-Payment Redirection
- **Current:** `/app/checkout/success` likely redirects to `/app/dashboard`. If the business is a skeleton ("My Business"), the dashboard will load in a generic state.
- **Required:** `/app/checkout/success` needs to check if the business is a "skeleton" (e.g., by checking a flag or the lack of onboarding completion) and redirect the user to `/app/onboarding` *after* the payment succeeds.

### E. Entitlement & Webhook Integrity
- **Current:** The webhook logic (`process_payment_webhook`) assumes the invoice and subscription are linked to a valid business. If a skeleton business is used, the webhook will successfully mark the subscription as active.
- **Required:** No changes strictly necessary to the webhook, as long as the skeleton `business_id` is passed correctly into the `metadata.business_id` during `createCheckout`.

### F. Security & Tampering
- **Current:** No client-controlled prices or discounts exist. All checkout generation relies on server-side plan ID lookup and RPC validation for coupons.
- **Required:** Fully aligned.

---

## 3. Recommended Redesign Plan

Since the instruction is "Do not fix yet," here is the precise execution plan when ready:

1. **Update `src/domains/auth/actions.ts`:**
   Modify `verifyOtpAndCreateUser` and `loginWithPin` to check for `checkout_intent`. If present, override `getRedirectPath` and `redirectTo: '/app/checkout'`.

2. **Update `src/domains/billing/actions/checkout.ts`:**
   Remove the strict `!businessIdCookie` block. Conditionally skip the `business_members` check if `businessIdCookie` is missing. Allow `businessIdCookie` to be passed as `undefined` to `createSession`.

3. **Update `/app/checkout/success/page.tsx`:**
   After verifying the session, fetch the `business.name` or an `is_onboarded` flag. If it's the skeleton business, enforce a redirect to `/app/onboarding`.

4. **Update `src/domains/business/actions.ts` (`completeOnboarding`):**
   Modify `completeOnboarding` to support *updating* an existing skeleton business rather than *always* inserting a new one. If the user already has a skeleton business (created during checkout), the onboarding wizard should `UPDATE businesses` instead of `INSERT`.

**Status:** Awaiting authorization to execute redesign.
