# BizTrack BD: Next Steps & Upcoming Sprints

With the **Financial Integrity (P0) double-counting bug fully resolved** (Sprint 8), the database ledger is mathematically sound. 

Below is the consolidated roadmap for the remaining critical phases, drawn from the Master Remediation Plan and the Audit documents. These should be tackled in order of priority to ensure security, performance, and growth.

---

## [DONE] Sprint 9: Core Security Hardening (P0 - CRITICAL)
*These address existential threats to data privacy and subscription revenue.*

- [ ] **1. Tenant Isolation Breakdown (IDOR):** 
  - Rewrite `is_business_member()` RLS function.
  - Currently, it relies on `businesses.owner_id`, missing staff members and failing open on syntax errors. Needs to use JWT claim caching to prevent nested loop crashes.
- [ ] **2. Immutable Ledger Enforcement:** 
  - Remove permissive `UPDATE` and `DELETE` policies on `transactions` and `account_transactions`.
  - Implement a voiding/reversing system (append-only) to protect financial reports.
- [ ] **3. Subscription Webhook Security:** 
  - `process_payment_webhook` is currently a public stub. 
  - Add cryptographic signature verification (Stripe/UddoktaPay) and idempotency keys to prevent attackers from activating free SaaS tiers.
- [ ] **4. Server-Side Cart Validation:** 
  - Modify `process_pos_sale` to calculate prices on the server. Currently, it trusts the total amount calculated by the client's browser.

---

### 🟢 Sprint 10: Performance & Scalability (P1) [DONE]
**Goal:** Address system performance under production load before adding new modules.

- [x] **1. Missing Foreign Key Indexes:**
  - Create B-Tree indexes for all `business_id` and `branch_id` columns across all tables.
  - Create indexes for heavily filtered columns (`category_id`, `type`).
- [x] **2. Dashboard O(N) Degradation:**
  - Update `get_dashboard_summary` RPC.
  - Replace `COUNT(*)` with `.limit(1)` existence checks or materialized views for low-stock counts to prevent full table scans.
- [x] **3. Hardcoded Data Limits (Pagination):**
  - Remove `.limit(50)` hardcodes in server actions. 
  - Implement cursor-based pagination and infinite scrolling for Transactions, Inventory, and Customers.

---

## [DONE] Sprint 11: Landing Page & Conversions (P1 - HIGH)
- [x] 1. Fix Broken CTAs: All Call-To-Action buttons currently point to 404 dead ends (`/login`, `/signup`). Update `href` attributes to the actual Next.js routes (`/app/login`, `/app/onboarding`).
- [x] 2. Foundational SEO: Add `robots.txt`, dynamic `sitemap.ts`, canonical URLs in layouts. Design and add an OpenGraph `og:image` so social shares render beautifully instead of showing blank text boxes.

---

## [DONE] Sprint 12: UX & Operations Polish (P2 - MEDIUM)
*These fix "fat-finger" errors and give admins better visibility.*

- [x] **1. Mobile Responsiveness:**
  - Fix Android keyboard pushing the bottom navigation bar up over input forms.
  - Add vertical scrolling to the POS Checkout Dialog so the "Pay" button isn't pushed off-screen.
  - Enlarge POS touch targets to at least 48x48px.
- [x] **2. Notification System Rebuild:**
  - Build real PostgreSQL triggers for low stock and subscription expiry.
  - Fix read-status to use a proper tenant-specific join table instead of shared global state.
- [x] **3. Audit Logs:**
  - Add logging for Super Admin impersonation events and sensitive read operations.

---

## Future Feature Roadmap (Post-Launch)
*Advanced features to build competitive moats.*

- [x] **Phase 9:** Business Health Score dashboard
- [x] **Phase 10:** Actionable Insights engine
- [x] **Phase 11:** Smart Business Alerts (automated SMS/push)
- [x] **Phase 12:** AI Business Assistant (chat-based insights)
- [ ] **Phase 13:** Bangla Voice Accounting (speech-to-text POS)
