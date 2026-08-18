# BizTrack BD — Task List

_Last updated: 2026-08-17_

## 🔴 P0 — Must Fix Before Private Beta

- [ ] **Billing webhook idempotency** — add `gateway_event_id` dedup + atomic processing (UddoktaPay)
- [ ] **Billing lifecycle hardening** — renewal, cancellation, failed payment, expired subscription handling
- [ ] **Support attachments** — private bucket + signed URL generation (currently assumes public bucket)
- [ ] **Audit all docs/** — read 27 audit files, organise all gaps into a fix tracker

## 🟠 P1 — Must Fix Before Production

- [ ] **Business Health Score** (ChatGPT Prompt 20) — explainable health indicators (Sales/Profit/Cash/Receivables/Inventory)
- [ ] **RBAC scalability** — decouple hardcoded `ROLE_PERMISSIONS` map into Role → PermissionGroup → Permissions
- [ ] **Inventory reversal model** — immutable movements with correction entries, no hard deletes of movements
- [ ] **Performance audit** — N+1 queries, pagination, RLS column indexes
- [ ] **Error observability** — structured server-side diagnostics, request correlation IDs
- [ ] **Mobile Money hardcoding bug** — `get_daily_closing_summary` uses ILIKE '%bkash%'; breaks for custom-named accounts
- [ ] **Expected Cash desync bug** — Daily Closing RPC ignores `opening_balance` and `income` types → wrong expected cash

## 🟡 P2 — Product Differentiation

- [ ] **Business Intelligence / Actionable Insights** (ChatGPT Prompt 21)
- [ ] **Smart Alerts** — low stock, overdue dues, expense spikes, missing daily closing (ChatGPT Prompt 22)
- [ ] **Landing page redesign** — conversion-focused, Bangla-first with Money Visibility hero (ChatGPT Prompt 25)
- [ ] **Account transfers UI** — no UI/action to move money between accounts (Bank → Cash etc.)

## 🟢 P3 — Future / Backlog

- [ ] **AI Business Assistant** — read-only Bangla queries (ChatGPT Prompt 23)
- [ ] **Bangla voice accounting** (ChatGPT Prompt 24)
- [ ] **Full test suite** (ChatGPT Prompt 28)
- [ ] **Red-team audit** (ChatGPT Prompt 29)
- [ ] **Production launch gate** (ChatGPT Prompt 30)
- [ ] **Offline POS product cache** — cache products/prices/customers for fully offline POS

## ✅ Done

- [x] Financial atomicity — `create_transaction_atomic` RPC, concurrency locks migration
- [x] SECURITY DEFINER hardening — all new functions have safe `search_path` + explicit REVOKE
- [x] Transaction RLS — removed `sales.create` fallback; explicit rules per type
- [x] POS RPC server-authoritative — membership validation, server-calculated totals
- [x] Daily Closing server-calculated — client sends only `actual_cash + reason`
- [x] SMS key removed from NEXT_PUBLIC_ — `SMS_NET_BD_API_KEY` server-only
- [x] Money Visibility ("আমার টাকা কোথায়?") — Cash/bKash/Nagad/Bank/Due/Net Position dashboard
- [x] Forgot PIN / PIN reset flow — OTP verify → admin updateUserById → auto-login
- [x] SMS gateway admin test UI — settings page with phone tester
- [x] Alert → Toast migration — 9 files converted to Sonner toasts
- [x] Offline daily_closing — `ClosingClient` queues offline; `OfflineSyncProvider` handles it
- [x] OfflineIndicator Retry/Discard — users can retry or clear failed syncs
- [x] Platform audit system — admin can run pre-launch audits
- [x] Pre-launch SaaS fixes — entitlement engine consolidated
