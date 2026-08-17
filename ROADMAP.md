# BizTrack BD — Implementation Roadmap

> Based on the GPT-4o codebase audit (August 2026) cross-checked against the current repo state.
> Overall: **~60% technically built, ~38% production-ready.**
> Goal: private beta → public launch → market-leader product.

---

## Current Status Snapshot

| Area | Completion | State |
|---|---|---|
| Core architecture (Next.js, domains, Supabase) | 80% | ✅ Solid |
| Multi-tenancy & RLS foundation | 80% | ✅ Solid |
| Database schema (33 tables, 31 migrations) | 75% | ✅ Solid |
| Authentication | 70% | 🟡 Needs hardening |
| Income / Expense / Khata | 70% | 🟡 Atomic now, RLS needs fix |
| POS | 75% | 🟡 Partially hardened |
| Inventory | 70% | 🟡 Atomic, immutable movements |
| Daily Closing | 65% | ✅ Server-authoritative now |
| Dashboard / Reports | 70% | 🟡 OK for beta |
| RBAC | 60% | 🔴 No canonical model |
| Offline | 45% | 🔴 Not production-ready |
| SaaS foundation & entitlements | 75% | ✅ Solid |
| Billing (UddoktaPay) | 50% | 🔴 Missing idempotency |
| Super Admin | 70% | 🟡 Needs consolidation |
| Security hardening | 55% | 🔴 RLS fallback, SECURITY DEFINER |
| Production readiness | **38%** | 🔴 Not yet |
| Product differentiation | 35% | 🔴 Not started |

---

## What Was Fixed (Commit `a7ec9a2`, Aug 17 2026)

### Financial Integrity
- [x] **`create_transaction_atomic` RPC** — transactions + account_transactions now a single atomic PostgreSQL operation. No more `success: true` on partial failure.
- [x] **`create_product_atomic` RPC** — product creation + initial inventory movement is atomic.
- [x] **`process_pos_sale` hardened** — payment accounts validated against `business_id`; `p_user_id` now comes from `auth.uid()` via server context, not client.
- [x] **Party balance trigger rewritten** — handles `opening_balance` type, party reassignment, and state `completed ↔ draft` transitions.
- [x] **Daily closing is server-authoritative** — `closeDay` action calls `get_daily_closing_summary` RPC to compute `expected_cash` and `difference`; client only submits `actual_cash` + `reason`.
- [x] **Daily closings immutable** — RLS `UPDATE/DELETE` blocked (`USING (false)`).
- [x] **Inventory movements immutable** — RLS `UPDATE/DELETE` blocked.
- [x] **Inventory concurrency lock** — `set_inventory_movement_balances` trigger uses `SELECT … FOR UPDATE` to prevent race conditions on concurrent sales.
- [x] **Double-stock trigger bug fixed** — `trg_maintain_product_stock` (AFTER INSERT) dropped; only the BEFORE INSERT trigger with lock runs.
- [x] **Transaction date timezone** — default changed from `current_date` (UTC) to `(NOW() AT TIME ZONE 'Asia/Dhaka')::date`.
- [x] **Zero-quantity constraint** — `inventory_movements.quantity != 0` constraint added.
- [x] **Financial summary fixed** — `purchase` excluded from `total_expense`; `get_inventory_analytics` uses cached `current_stock`.

### Auth & Server Action Infrastructure
- [x] **`authAction` wrapper** — validates session + business membership on every server action.
- [x] **`idempotentAction` wrapper** — prevents double-processing financial operations via `idempotency_keys` table.
- [x] **`requirePermission` wrapper** — enforces RBAC before executing server actions.
- [x] **`adminAction` wrapper** — enforces platform admin check with audit logging.
- [x] **Rate limiting** — basic rate limit applied to all auth/admin actions.

### SaaS & Admin
- [x] Support system (tickets, replies, admin views)
- [x] Feature flags system (per-business overrides)
- [x] Platform notifications system
- [x] Landing page

---

## Remaining Work by Phase

---

### Phase 1 — Security Hardening (P0 — Do before any new feature)

These are pre-beta blockers. No new features until these are done.

#### 1.1 Fix Transaction RLS `sales.create` Fallback 🔴 P0

**File:** `supabase/migrations/20260816120000_rbac_and_audit.sql` line 92

The INSERT policy for `transactions` has:
```sql
public.has_permission(auth.uid(), business_id, 'sales.create') -- fallback for edge cases
```
This lets any user with `sales.create` insert **any** transaction type (expense, purchase, transfer, opening_balance) by hitting the Data API directly.

**Fix:** New migration that rewrites the INSERT policy with explicit per-type rules:
```sql
-- sale, payment_in → requires sales.create
-- expense, payment_out → requires expenses.create
-- purchase → requires inventory.manage
-- transfer → requires settings.manage
-- opening_balance → requires owner role
-- No fallback.
```

#### 1.2 SECURITY DEFINER `search_path` Hardening 🔴 P0

**File:** All migrations before `20260817140000`

Every `SECURITY DEFINER` function must set:
```sql
SET search_path = public, pg_temp;
```
to prevent search_path injection attacks.

Functions to harden (from audit):
`process_pos_sale`, `handle_new_business`, `handle_new_user`, `is_business_member`, `validate_coupon`, `redeem_coupon`, `get_daily_closing_summary`, `get_business_entitlements`, `get_dashboard_summary`, `has_permission`, `maintain_party_balance_on_opening_change`, `create_transaction_atomic`, `create_product_atomic`, `get_financial_summary`, `get_party_dues`, `get_inventory_analytics`

**Fix:** New migration that uses `CREATE OR REPLACE` on each function, adding `SET search_path = public, pg_temp;` after `LANGUAGE plpgsql`.

Also audit EXECUTE grants — ensure `anon` role cannot call privileged functions.

#### 1.3 POS Server-Side Total Recalculation 🔴 P0

**File:** `src/domains/pos/actions.ts`, `supabase/migrations/…process_pos_sale`

Currently `p_total_amount`, `p_subtotal`, `p_discount` come from the client. The RPC trusts these numbers.

**Fix:** Inside `process_pos_sale` RPC, look up each product's `price` from the database and compute `subtotal = quantity × price`. Reject if client-supplied total doesn't match. Client supplies only: `product_id`, `quantity`, `party_id`, `payment_method`, `discount_amount` (if permitted).

#### 1.4 Fix SMS API Key Exposure 🟡 P1

**Files:** `src/app/api/auth/sms-hook/route.ts:4`, `src/domains/auth/actions.ts:8`

Both files use `process.env.NEXT_PUBLIC_SMS_NET_BD_API_KEY` as fallback. This prefix exposes the key to the browser bundle.

**Fix:**
- Remove all `NEXT_PUBLIC_SMS_NET_BD_API_KEY` references.
- Use `SMS_NET_BD_API_KEY` (server-only) exclusively.
- Update `.env.example` and Vercel env config.

---

### Phase 2 — RBAC & Authentication Hardening (P1)

#### 2.1 Authentication Edge Cases

Verify these server-side protections exist:
- Suspended users cannot perform financial operations
- Suspended businesses cannot perform mutations
- Email verification enforced for financial operations
- Session expiry handled gracefully (no half-submitted forms)
- Middleware covers all `/app/**` and `/admin/**` routes

#### 2.2 Canonical RBAC Model

**Problem:** Permission logic is duplicated across React components, server actions, and PostgreSQL. The current `ROLE_PERMISSIONS` map in `safe-action.ts` is the only canonical source, but the DB-level `has_permission` function has its own copy.

**Fix:**
- Consolidate to one source of truth in PostgreSQL (`role_permissions` table or function).
- Remove the hardcoded `ROLE_PERMISSIONS` object from `safe-action.ts` — derive it from the DB.
- UI hides/disables for UX only; server + DB enforce actual access.
- Document the permission matrix:

| Permission | owner | manager | cashier | staff |
|---|---|---|---|---|
| sales.create | ✅ | ✅ | ✅ | ❌ |
| expenses.create | ✅ | ✅ | ❌ | ❌ |
| inventory.manage | ✅ | ✅ | ❌ | ❌ |
| closing.manage | ✅ | ✅ | ✅ | ❌ |
| staff.manage | ✅ | ✅ | ❌ | ❌ |
| settings.manage | ✅ | ✅ | ❌ | ❌ |
| reports.view | ✅ | ✅ | ❌ | ❌ |

---

### Phase 3 — Billing Production Hardening (P1)

**File:** `src/app/api/cron/billing/route.ts`, `src/domains/billing/actions.ts`

Current billing is partially wired (UddoktaPay). Missing:

- [ ] **Webhook signature verification** — verify the request actually comes from UddoktaPay
- [ ] **Webhook idempotency** — store `provider_event_id`; reject duplicates
- [ ] **Atomic webhook processing** — invoice update + subscription activation in one transaction
- [ ] **Subscription lifecycle handling** — `success`, `failed`, `cancelled`, `expired`, `refunded`, `renewal`
- [ ] **Entitlement refresh after payment** — subscription status checked server-side on every gated action
- [ ] **Grace period for expired subscriptions** — don't cut off on expiry date, give 24–48h buffer

---

### Phase 4 — Offline Architecture (P1)

Current state: ~45% — foundation exists (IndexedDB, mutation queue), not production-ready.

**Required for production-grade offline:**
- [ ] Offline POS — cache products, prices, stock snapshot, customers; queue sales
- [ ] Idempotent sync — every queued mutation has a `client_operation_id`; server deduplicates on sync
- [ ] Conflict resolution — what happens if a product goes out of stock while offline?
- [ ] Offline income/expense entry
- [ ] Sync status UI — show user what's pending, what synced, what failed
- [ ] Retry with backoff for failed sync operations

---

### Phase 5 — Design System & UX (P2 — after P0+P1 done)

**Target user:** Bangladeshi small-shop owner, low-end Android, limited internet.

**Design principles:**
- Mobile-first, touch-friendly tap targets
- Bangla language support for all primary flows
- Human terminology (not "Create Financial Transaction" → "আয় যোগ করুন")
- Primary flows reachable in ≤ 2 taps

**Primary flows to optimize:**
1. Add income → ≤ 2 taps
2. Add expense → ≤ 2 taps
3. Receive customer payment → ≤ 2 taps
4. Record supplier payment → ≤ 2 taps
5. Make POS sale → ≤ 3 taps
6. Check due (khata) → 1 tap
7. Today's profit → visible on dashboard
8. Close day → guided flow

**Design system unification:**
- One token set for colors, spacing, radius, shadows
- Consistent component variants for buttons, inputs, tables, cards, badges
- Consistent loading/empty/error states across all pages

---

### Phase 6 — Money Visibility ("আমার টাকা কোথায়?")

First major product differentiation feature. This is what makes BizTrack BD worth paying for.

**Dashboard upgrade:**
- Today's cash position (actual money in hand vs. on account)
- Today's profit (income − expense, updated in real-time)
- Outstanding dues: who owes you, how much
- Payables: who you owe, how much
- Cash flow trend (7-day sparkline)

**Khata upgrade:**
- Sort parties by highest due
- One-tap to record payment received
- WhatsApp message with due amount (deep link)
- Payment reminder history

**Daily closing insight:**
- Show variance trend over last 7 closings
- Flag days with large cash discrepancy

---

### Phase 7 — Business Health Dashboard

**Target:** Owner gets a 30-second health check every morning.

- Profit trend (daily/weekly/monthly)
- Top-selling products (by revenue and by units)
- Slow-moving inventory (products not sold in 30 days)
- Best customers (by lifetime value)
- Cash flow forecast (next 7 days based on payment patterns)
- Low stock alerts with one-tap reorder note

---

### Phase 8 — Smart Alerts & AI Assistant (Future)

- Push notifications for: low stock, overdue payments, unusual transaction
- Business health score (0–100, updated weekly)
- AI-powered insights: "Your sales are 20% lower this week — this usually happens after Eid"
- Voice input for quick transactions (Bangla speech-to-text)
- WhatsApp bot integration for khata updates

---

## Immediate Next Steps (Ordered)

```
P0-A  ✅ DONE — Fix transaction RLS — migrations/20260817160000_fix_transaction_rls.sql
P0-B  ✅ DONE — SECURITY DEFINER search_path — migrations/20260817170000_security_definer_hardening.sql
P0-C  ✅ DONE — POS server-side totals — migrations/20260817180000_pos_server_side_totals.sql
P0-D  ✅ DONE — Remove NEXT_PUBLIC_ from SMS API key references
P1-A  ✅ DONE — Auth hardening — suspended business check in authAction + middleware
P1-B  ✅ DONE — Canonical RBAC — migrations/20260817190000_rbac_canonical.sql
P1-C  ✅ DONE — Billing webhook — idempotency, atomicity, cron period advance + suspension cascade
P1-D  ✅ DONE — Offline POS — stuck-sync recovery, backoff, max retries, visibility sync, failed-sync UI
P2-A  Design system — token unification, Bangla labels, mobile UX
P2-B  Money Visibility dashboard
P2-C  Business Health dashboard
```

---

## Production Checklist (Before Public Launch)

- [ ] All P0 security issues resolved
- [ ] Supabase Security Advisor: zero high/critical findings
- [ ] Billing webhook tested end-to-end (success + failed + duplicate)
- [ ] Offline POS tested: sell while offline, sync when online
- [ ] Load test: 50 concurrent users, 1000 transactions/day
- [ ] Rate limiting verified on all public endpoints
- [ ] Error monitoring (Sentry or similar) connected
- [ ] Database backups confirmed
- [ ] Custom domain + SSL verified
- [ ] Privacy policy and Terms of Service published
- [ ] Support system functional (users can submit tickets)
- [ ] Feature flags tested for plan gating
- [ ] Supabase production checklist completed: https://supabase.com/docs/guides/deployment/going-into-prod
