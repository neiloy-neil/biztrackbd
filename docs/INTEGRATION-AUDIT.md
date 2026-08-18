# End-to-End Integration Audit

## Executive Summary
This document traces five critical real-world user journeys through the BizTrack platform, identifying the *first point of failure* across the stack (UI, APIs, RPCs, Database) for each scenario. The audit reveals that while the application's "happy path" functions conceptually, the integration between edge cases, offline functionality, and administrative controls is critically broken.

---

## JOURNEY 1: The Core Business Loop
**Path:** New business → signup → create business → subscription/trial → dashboard → create account → add product → add customer → make sale → receive payment → inventory updates → customer due updates → account balance updates → dashboard updates → report updates → daily closing

**First Point of Failure:** **Public Signup Funnel (UI Routing)**
- **Failure:** The very first step of the journey fails. The `<Link href="/signup">` button on the public landing page points to a 404 route instead of `/app/onboarding`.
- **Secondary Failure:** If the user manually navigates to the correct URL and completes the loop, the next critical failure is the Daily Closing snapshot. Because transactions are not immutable, editing a past transaction permanently breaks the data consistency between the historical `daily_closing` table and the live ledger.

## JOURNEY 2: The Offline Cashier
**Path:** Lose internet → make sale → save locally → reconnect → sync → verify server → verify inventory → verify account → verify customer → verify dashboard

**First Point of Failure:** **Misleading Offline Success & Silent Sync Rejection**
- **Failure:** When the cashier makes a sale while offline, the UI shows a green success toast ("Saved offline - will sync later"). However, when the network reconnects, if the server rejects the sale (e.g., negative inventory triggered by another branch, or an authorization error), the `process_pos_sale` RPC fails silently in the background queue.
- **Impact:** The cashier believes the sale succeeded, but the dashboard, inventory, and account balances are never updated on the server.

## JOURNEY 3: SaaS Subscription Lifecycle
**Path:** Signup → trial → payment → webhook → invoice → subscription → entitlement → feature unlocked

**First Point of Failure:** **Unauthenticated Webhook (Billing Bypass)**
- **Failure:** The `process_payment_webhook` RPC is publicly accessible and does not validate cryptographic signatures from UddoktaPay. 
- **Impact:** An attacker can skip the payment step entirely, call the webhook manually via the API, and activate their own subscription for free.
- **Secondary Failure:** The Entitlement Engine checks usage limits in the UI (`canUseFeature()`), but fails to enforce these limits with database triggers, allowing attackers to abuse APIs to exceed limits anyway.

## JOURNEY 4: Platform Administration
**Path:** Business created → admin sees business → admin sees subscription → admin sees invoice → admin support ticket → admin action → audit log

**First Point of Failure:** **Support System Identity Forgery & Data Leak**
- **Failure:** When the admin views a support ticket, any attachments uploaded by businesses are publicly exposed in the storage bucket because RLS lacks a tenant check. Furthermore, when the Admin replies to the ticket, the system allows the malicious business user to intercept the API and reply *as the Admin* by forging the `sender_id`.
- **Secondary Failure:** The Audit Log system (`audit_logs`) only tracks `INSERT/UPDATE/DELETE` triggers. Read access or manual administrative overrides (e.g. impersonation) are not logged, blinding the platform to insider threats.

## JOURNEY 5: The Malicious Insider (Cross-Tenant Security)
**Path:** Business A user → attempts Business B access → attempts restricted operation → attempts direct RPC → attempts modified request

**First Point of Failure:** **Broken Tenant Isolation (IDOR)**
- **Failure:** The user instantly succeeds in accessing Business B's data. The `is_business_member(uuid)` function used universally across the platform's Row-Level Security (RLS) policies contains a logical flaw.
- **Impact:** The attacker can execute a `SELECT * FROM transactions WHERE business_id = <Business B UUID>` and retrieve the competitor's entire financial ledger.

---

## Conclusion
The platform fails 5 out of 5 core journeys due to a combination of broken UI routing, unauthenticated billing webhooks, missing offline error handling, and catastrophic database RLS flaws. 

The system cannot be launched until the foundational Security Core (Phase 1) is completely rebuilt.
