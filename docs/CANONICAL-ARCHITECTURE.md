# CANONICAL ARCHITECTURE
**BizTrack BD**

## Core Principle
BizTrack BD operates on **ONE SUPABASE PROJECT** containing a shared PostgreSQL database, serving two strictly isolated security planes.

---

### 1. Business Authentication
- **Mechanism:** Supabase GoTrue via standard `supabase.auth`.
- **Primary Factors:** Mobile OTP or Email OTP.
- **Context:** The standard `auth.users` maps to business users (owners, managers, staff).
- **Session:** Managed via cookies bound to the standard Supabase client.

### 2. Admin Authentication
- **Mechanism:** Supabase GoTrue via a dedicated Admin Auth Client.
- **Primary Factors:** Email & Password.
- **Context:** The standard `auth.users` maps to Super Admins, verified via the `platform_admins` table.
- **Session:** Managed via a separate cookie key space to prevent session cross-contamination between a user who is simultaneously an Admin and a Business Owner.

### 3. Business Authorization
- **Mechanism:** Role-Based Access Control (RBAC) via the `business_users` table (`role` enum: owner, manager, staff).
- **Enforcement:** Enforced at the Server Action level via `authAction()` and client-side UI guards.
- **Tenant Context:** `business_id` is derived from the session's active business selection.

### 4. Platform Authorization
- **Mechanism:** Platform-level RBAC via `platform_admins` (`platform_role`) and `platform_permissions`.
- **Enforcement:** Enforced at the Server Action level via `adminAction()` which hard-validates the user's platform role against the required permissions before proceeding.

### 5. Supabase Client Boundaries
- **Business Routes (`/app/*`):** MUST use `createClient()` (standard authenticated client).
- **Admin Routes (`/admin/*`):** MUST use `createAdminAuthClient()` to retrieve the session, and the Service Role client for operations (since Admin routes bypass business RLS).

### 6. Server Action Boundaries
- **Business Actions:** MUST be wrapped in `authAction()` or `idempotentAction()`.
- **Admin Actions:** MUST be wrapped in `adminAction()`. Normal auth actions must never mutate platform state.

### 7. RLS Boundaries
- **Business Data:** All tables (`transactions`, `inventory`, `parties`) must enforce `business_id = current_setting('app.current_business_id')`.
- **Admin Bypass:** Platform tables (e.g., `platform_settings`) have RLS policies restricting access to admins, OR are accessed exclusively via the Service Role client from `adminAction()`.

### 8. Service-Role Usage
- **Restriction:** The `SUPABASE_SERVICE_ROLE_KEY` MUST NEVER be exposed to the client.
- **Usage:** It may only be utilized on the server inside `adminAction()` wrappers, cron jobs (`/api/cron/*`), or verified external webhooks (e.g., Stripe/UddoktaPay).

### 9. Billing Ownership
- **Structure:** Billing (plans, subscriptions, invoices, quotas) sits in the shared space but belongs conceptually to the Platform.
- **Mutation:** Business users can generate checkout sessions, but ONLY verified Webhooks or Super Admins can alter subscription statuses or entitlements.

### 10. Tenant Isolation
- **Rule:** A business user's token is cryptographically bound to their `auth.uid()`. Their ability to read/write is strictly filtered by RLS so that `business_A` data can never leak to `business_B`.

### 11. Route Structure
**Public:**
- `/` (Landing page, pricing)

**Business:**
- `/login`, `/signup`
- `/app/*` (Dashboard, POS, Settings, Billing checkout)

**Admin:**
- `/admin/login`
- `/admin/*` (Super Admin dashboard, SaaS management, User oversight)
