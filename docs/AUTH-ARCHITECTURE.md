# Authentication & Authorization Architecture

## 1. Single-Project Dual-Plane Concept

BizTrack uses a **Single Supabase Project** architecture with **Two Security Planes**:
1. **Business Plane**: Serves `app.biztrackbd.com`
2. **Admin Plane**: Serves `admin.biztrackbd.com`

Both planes connect to the EXACT SAME Supabase instance, but they maintain strictly separated sessions and authorization models.

## 2. Session Isolation

By default, Supabase creates a cookie named `sb-[ref]-auth-token`.
To prevent Business and Admin sessions from overlapping, we utilize custom cookie keys at the application level.

### Business Plane
- **Client Initialization**: `createClient()` (from `@/lib/supabase/server`)
- **Cookie Key**: `sb-[ref]-auth-token` (Default)
- **Middleware Boundary**: Checks the default cookie for routes under the business domain (`app.biztrackbd.com`). 

### Admin Plane
- **Client Initialization**: `createAdminAuthClient()` (from `@/domains/auth/admin-actions.ts`)
- **Cookie Key**: `sb-admin-auth-token` (Custom)
- **Middleware Boundary**: Checks the custom admin cookie for routes under the admin domain (`admin.biztrackbd.com`).

**Why this works:**
If an admin logs in at `admin.biztrackbd.com`, their browser receives `sb-admin-auth-token`. If they navigate to `app.biztrackbd.com`, the business middleware looks for the default cookie, finds nothing, and denies access. The sessions are entirely mathematically isolated despite sharing the same `auth.users` pool.

## 3. The Authentication Lifecycle

### Business Flow
1. User logs in via Mobile OTP or Email OTP.
2. Default Supabase session is established.
3. User authorization is verified against `business_members` table and business RLS policies.
4. Server actions are wrapped in `businessAction()`.

### Admin Flow
1. Admin logs in via Email (AdminLoginForm) at `/admin/login`.
2. Admin credentials are submitted to the primary Supabase instance.
3. If successful, we verify `platform_admins` membership IMMEDIATELY before generating the response.
4. The `sb-admin-auth-token` cookie is written to the browser.
5. Server actions are wrapped in `adminAction(permission)`.

## 4. Platform Role-Based Access Control (RBAC)

Admins are not omnipotent. Admin actions and API calls must request explicit permissions. 
The legacy `is_platform_admin()` has been deprecated in favor of a granular RBAC matrix handled by `has_platform_permission()`.

**Roles:** `super_admin`, `billing`, `support`

**Permissions:** 
- `platform.dashboard.view`
- `platform.users.manage`
- `platform.billing.manage`
- `platform.support.manage`
- *(See `20260819040000_admin_rbac.sql` for the full list)*

**RLS Enforcement:**
Row-Level Security checks invoke `has_platform_permission('platform.module.action')`. If an admin only has `platform.support.manage`, any attempt to read or modify `public.plans` will result in a generic RLS block.
