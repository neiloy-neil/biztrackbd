# ARCHITECTURE VIOLATIONS
**Status:** Audit Completed 2026-08-19

During the architecture audit, the following severe violations of the canonical dual-plane architecture were identified.

## 1. `adminAction` uses the Business Client (`createClient`)
**File:** `src/lib/actions/safe-action.ts` (Lines 219-222)
**Violation:**
The `adminAction` wrapper function internally calls `await createClient()`. 
`createClient` parses the standard `sb-[project]-auth-token` (the business plane cookie). It does *not* read the `sb-admin-[project]-auth-token` (the admin plane cookie).
**Consequence:** 
If an admin logs in via `/admin/login` (which sets the admin cookie), but is NOT logged into the business side, any server action wrapped in `adminAction()` will fail with "Unauthorized: No active session". Conversely, if a user is logged into the business side, it checks their business session against the `platform_admins` table, breaking the strict isolation between the two planes.

## 2. Admin Route Layout uses the Business Client (`createClient`)
**File:** `src/app/admin/(protected)/layout.tsx` (Lines 21-23)
**Violation:**
The layout explicitly imports and calls `createClient()` with a comment claiming it is "standard for data fetching". 
**Consequence:**
Any data fetching done in the admin layout or its children using `createClient()` relies on the business plane authentication state instead of the admin plane authentication state, again breaking tenant isolation and potentially exposing or blocking data incorrectly.

## 3. Admin Domain Actions use the Business Client (`createClient`)
**Files:** 
- `src/domains/admin/actions.ts` (Multiple lines)
- `src/domains/admin/invoice.actions.ts` (Multiple lines)
- `src/domains/admin/team.actions.ts` (Multiple lines)
**Violation:**
Inside the body of actions wrapped with `adminAction`, the code manually instantiates `const supabase = await createClient()`. 
**Consequence:**
Even if `adminAction` was fixed to use the admin client, the inner logic of these admin features rebuilds the business client and executes queries using the business session. Furthermore, if these actions need to bypass RLS (since admin queries are cross-tenant), they must use the `service_role` client. Using the `createClient()` (authenticated role) will cause admin queries to silently fail or return 0 rows due to RLS `business_id` constraints.

## Recommended Fix Strategy
1. **Fix `adminAction`:** Update `src/lib/actions/safe-action.ts` to use `createAdminAuthClient()`.
2. **Inject the correct client:** `adminAction` should provide the initialized Admin client (or the Service Role client, depending on the query need) in the `ctx` object, so inner functions do not need to construct their own clients.
3. **Purge `createClient` from Admin:** Ban the import of `createClient` anywhere inside `src/app/admin/` and `src/domains/admin/`.
