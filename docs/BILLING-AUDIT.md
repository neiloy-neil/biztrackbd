# Billing & Checkout Audit

## Executive Summary
This document outlines the findings of the end-to-end billing audit. The entire payment pipeline is completely non-functional due to disconnected identifiers, dead code, and critical logic omissions. If this were deployed, 100% of payments would be collected by the payment gateway, but 0% of subscriptions would be activated in the database. 

---

## 1. The Disconnected Webhook Pipeline (Critical Failure)

The flow between creating a checkout and receiving a webhook is fundamentally broken because the local database and the remote payment provider do not share an identifier.

1. **Checkout Creation:** `BillingService.createSubscriptionCheckout` inserts a new row into `public.invoices`. It generates a UUID.
2. **Provider Call:** It calls UddoktaPay's `/checkout` API and passes the internal `invoice.id` as `metadata.invoice_id`. UddoktaPay returns a `paymentUrl`. **Crucially, UddoktaPay's remote invoice ID is never returned here, and thus `uddoktapay_invoice_id` is left NULL in the database.**
3. **The Webhook:** UddoktaPay fires a webhook containing `invoice_id` (which is UddoktaPay's internal ID, not the metadata UUID). 
4. **The SQL Failure:** The API route `src/app/api/webhooks/uddoktapay/route.ts` calls the SQL RPC `process_payment_webhook(p_uddoktapay_invoice_id)`. The RPC executes:
   `SELECT * FROM public.invoices WHERE uddoktapay_invoice_id = p_uddoktapay_invoice_id`
5. **Result:** Because `uddoktapay_invoice_id` is NULL for every invoice in the database, the query fails with `invoice_not_found`. The subscription is never activated.

---

## 2. Upgrades & Downgrades (The "Black Hole" Bug)

Even if the webhook pipeline worked, it is impossible for a user to upgrade their plan.

- **The Missing Link:** The `invoices` table does not contain a `plan_id` column. When a user clicks "Upgrade to Enterprise", the system creates an invoice for the $99 amount, but completely forgets *what* they are paying for.
- **The Webhook Logic:** When the `process_payment_webhook` RPC executes, it simply does this:
  `v_new_period_end := v_sub.current_period_end + INTERVAL '1 month';`
  It extends the time of the *current* subscription but never changes the `plan_id`. 
- **Result:** A Free user who pays for Enterprise will successfully be charged $99, but their subscription will remain on the Free plan forever. 

---

## 3. Manual Activation Vulnerability (Security Definer Flaw)

The `process_payment_webhook` RPC is marked as `SECURITY DEFINER` (running as a superuser to bypass RLS). 
- **The Flaw:** There is no `REVOKE ALL ON FUNCTION public.process_payment_webhook FROM public;` in the migrations.
- **The Exploit:** Any authenticated user can open their browser console and execute `supabase.rpc('process_payment_webhook', { p_uddoktapay_invoice_id: '...', p_status: 'COMPLETED' })`. 
- **Current Mitigation:** Ironically, because `uddoktapay_invoice_id` is never saved (Bug #1), an attacker cannot guess the ID to exploit this. If Bug #1 is fixed without fixing this, users will be able to activate their own subscriptions for free.

---

## 4. Dead Code

`BillingService.processPaymentWebhook` in `src/domains/billing/service.ts` contains a fully functional TypeScript implementation that correctly verifies the payment with the provider API and reads `metadata.plan_id`. However, this function is completely ignored. `route.ts` bypasses it entirely to call the broken SQL RPC.

---

## Conclusion
The billing module requires a complete architectural rewrite. The webhook route must be updated to either use the TypeScript `BillingService` or the SQL RPC must be modified to read `metadata.invoice_id` and `metadata.plan_id` from the payload, rather than relying on a non-existent `uddoktapay_invoice_id`. Additionally, the RPC must be revoked from the `public` role.
