# Public Checkout Flow Audit

## Overview
This document audits the SaaS purchase flow from the public landing page to full subscription activation, tracking the journey of a user selecting a plan, creating an account, onboarding, and paying for a subscription.

---

### 1. What already works?
- **Pricing Display:** `PricingSection.tsx` dynamically fetches active plans from the `plans` table and renders them beautifully.
- **Provider Abstraction:** `BillingService` elegantly abstracts payment providers (UddoktaPay, Mock) using a factory pattern.
- **Checkout Generation:** `BillingService.createSubscriptionCheckout()` successfully generates draft `invoices` and calls the provider to generate a payment URL, safely attaching metadata.
- **Webhook Processing:** The system handles incoming webhooks, verifies them server-to-server with the provider, and updates the invoice and subscription status via the idempotent `process_payment_webhook` RPC.
- **Business Creation:** The `OnboardingWizard` successfully creates the business, branches, and accounts via the `complete_onboarding` RPC.

### 2. What is partially implemented?
- **Promotions & Credits:** `createSubscriptionCheckout` queries `promotional_credits` and reduces the checkout amount, but notes that it doesn't actually deduct the credits from the user's balance permanently.
- **Trial / Default Entitlements:** The `increment_transaction_usage` trigger handles cases where a `business_id` has no active subscription by silently granting them a "free/trial" period for the current month. However, it does not actually create a `subscriptions` row.

### 3. What is missing?
- **Subscription Row Creation:** The `complete_onboarding` RPC does **not** insert a row into the `subscriptions` table. A business has no subscription record until a draft invoice/checkout is manually generated.
- **Plan Context Persistence:** There is no mechanism to pass the `plan_id` selected on the landing page into the onboarding flow. 
- **Post-Onboarding Checkout Redirect:** After onboarding, the user is always redirected to `/dashboard`. There is no logic to automatically generate a checkout session if they had selected a paid plan.

### 4. What is disconnected?
- **Landing Page ↔ Backend:** The pricing cards on the landing page simply contain `<Link href="/app/onboarding">`. The user's choice is immediately discarded. The onboarding wizard does not ask for a plan, nor does it know about one. The user ends up on the dashboard with no plan attached.

### 5. Where can payment status be spoofed?
- **Direct RPC Execution:** The `process_payment_webhook` RPC is marked `SECURITY DEFINER`. It attempts to verify `p_webhook_secret` against `current_setting('app.webhook_secret')`. If `app.webhook_secret` is not set in the database configuration, the check is bypassed (`v_stored_secret IS NULL`). If a malicious user calls `supabase.rpc('process_payment_webhook', { ... })` directly from the frontend (since `EXECUTE` is not revoked from `PUBLIC`), they could spoof a `COMPLETED` status for any `uddoktapay_invoice_id` they know.
- **Webhook Endpoint:** The REST endpoint at `api/webhooks/` verifies the payment server-to-server with the provider, making it highly secure and un-spoofable as long as the provider's API isn't compromised.

### 6. Where can subscription activation be spoofed?
- Identical to payment status spoofing. Activating a subscription relies entirely on the `process_payment_webhook` RPC. If the RPC can be invoked directly by a malicious actor due to missing `REVOKE EXECUTE FROM PUBLIC` and a missing DB secret, they can activate subscriptions for free.

### 7. How does a plan selected on the landing page currently reach the backend?
- **It doesn't.** The pricing CTA is a static link to `/app/onboarding`. No URL parameters (e.g., `?plan=uuid`), cookies, or local storage mechanisms are used to carry the intent forward.

### 8. Can an anonymous visitor purchase?
- **No.** `createSubscriptionCheckout` strictly requires a `businessId`. To acquire a `businessId`, the visitor must authenticate, complete the onboarding wizard, and be assigned to a business.

### 9. Can the purchased plan be reliably attached to the correct user/business?
- **Yes.** The `invoices` table requires a `business_id`, and `createSubscriptionCheckout` passes this `business_id` securely inside the provider's checkout `metadata`. When the webhook returns, it looks up the exact invoice row and updates the associated `subscription_id`.

### 10. Can a successful payment automatically activate the plan?
- **Yes.** Upon a `COMPLETED` status, `process_payment_webhook` atomically marks the invoice as `paid`, sets the subscription status to `active`, and advances `current_period_end` by exactly 1 month from its previous boundary.

---

## Conclusion
The billing infrastructure, database schemas, and provider integrations are fundamentally solid and secure at the server level. However, the **user journey is broken**. A user cannot currently select a plan on the marketing site and automatically purchase it during or after onboarding because the handoff state is lost. Additionally, the `process_payment_webhook` RPC should have its execution privileges explicitly revoked from the `anon` and `authenticated` roles to prevent direct PostgREST spoofing.
