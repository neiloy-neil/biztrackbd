# BizTrack BD: Frontend/Backend Alignment Audit

This document tracks the alignment between frontend UI forms, Server Actions, Zod validation schemas, and database RPCs/RLS across the 24 business functional areas.

## Findings & Issues

### 1. Missing Branch Context in Mutations (P1 - Major)
**Issue**: Multi-branch support requires mutations (like Inventory Adjustments, POS checkout, Transaction recording) to log the `branch_id`. Currently, the `authAction` secure wrapper only extracts the `businessId` from the session cookie, but relies on a hardcoded "default branch" fetch inside the action bodies.
**Affected Domains**:
- Inventory (Adjustments): Explicitly queries `limit(1)` to guess the branch instead of using the active user's branch context.
- Transactions
**Fix Required**: Ensure the `AuthContext` injected by `authAction` also includes `branchId`, and that actions use `ctx.branchId` instead of querying random branches.

### 2. POS Submission Flow & Schema Mismatch (P1 - Major)
**Issue**: The POS Client (`POSClient.tsx`) builds a complex payload (items, quantities, totals). The backend `processCheckout` action needs strict Zod alignment with the frontend payload. If a Zod schema is missing or diverges, silent failures or calculation mismatches can occur at the RPC level.
**Fix Required**: Ensure `processCheckout` uses a Zod schema that strictly matches the POS frontend state, and that the RPC `record_transaction` accepts exactly that shape.

### 3. Stale Cache Invalidation (Fixed)
**Issue**: Several Server Actions were calling `revalidatePath` with stale or incorrect root paths. Because we normalized all routing to `/app/...`, these revalidations silently failed to bust the Next.js App Router cache.
**Status**: Fixed via codebase scan. All actions now call `revalidatePath('/app/...')`.

### 4. Dead Forms (Fixed)
**Issue**: Several components contained `<form>` tags without `action` or `onSubmit` handlers, leading to unintentional page reloads upon pressing enter.
**Status**: Fixed. Added `onSubmit={(e) => e.preventDefault()}` to filter forms in `inventory` and `support`.

## Remediation Plan (Next Steps)

1. **Fix Branch Context Extraction**: Update `src/lib/actions/safe-action.ts` to attach `branchId` to `AuthContext`.
2. **Update Mutations to use `ctx.branchId`**: Scrub `inventory/actions.ts` and `pos/actions.ts` to stop using `limit(1)` branch fetching.
3. **Align POS Zod Schemas**: Audit `pos/actions.ts` for strict payload validation.
